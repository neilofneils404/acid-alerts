// Exercise the actual panel's JavaScript handlers without a running desktop.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Model = require('../Model.js')
const source = fs.readFileSync(path.join(__dirname, '../Panel.qml'), 'utf8')
const functions = [...source.matchAll(/^  function (\w+)\([^\n]*\) \{[\s\S]*?^  \}/gm)]
const fixture = fs.readFileSync(path.join(__dirname, 'nws-flood-advisory.json'), 'utf8')
const empty = JSON.stringify({ type: 'FeatureCollection', features: [] })

function panel() {
  const root = {
    demoMode: false, located: true, location: { name: 'Test town' },
    incomingAlerts: [], alerts: [], selectedIndex: 0,
    fetchError: '', fetchInFlight: false, hasSuccessfulFetch: false,
    fetchGeneration: 0, requestGeneration: 0, responseReady: false,
    requestExited: false, requestExitCode: -1, responseBody: '',
    zoneCache: {}, lastUpdated: '', firstLoad: true,
    filter: Model.parseFilter({ showAdvisories: true }),
    refreshCalls: 0,
  }
  Object.defineProperties(root, {
    selected: { get: () => root.alerts[root.selectedIndex] || null },
    alertCount: { get: () => root.alerts.length },
    filteredOut: { get: () => root.incomingAlerts.length > 0 && !root.alerts.length },
  })
  const context = vm.createContext({
    root, Model,
    Qt: { formatDateTime: () => 'Sep 18 3:00 PM', callLater: fn => fn() },
    locationLabel: () => root.location.name,
    notifyNewAlerts: () => {}, persistSeen: () => {},
  })
  for (const match of functions) {
    vm.runInContext(match[0], context)
    root[match[1]] = context[match[1]]
  }
  context.notifyNewAlerts = () => {}
  context.persistSeen = () => {}
  root.enqueueZones = () => {}
  root.refresh = () => { root.refreshCalls++ }
  root._vm = context
  return root
}

// A successful, empty FeatureCollection is the only empty response we accept.
for (const raw of ['', ' ', '{}', 'null', '[]', '{',
  '{"type":"FeatureCollection"}', '{"type":"FeatureCollection","features":{}}',
  '{"type":"FeatureCollection","features":[{}]}',
  '{"type":"FeatureCollection","features":[null]}',
  '{"type":"Problem","features":[]}', '{"title":"Service unavailable"}']) {
  assert.ok(Model.parseCollection(raw).error, raw)
  const p = panel()
  p.applyPayload(raw)
  assert.equal(p.statusHeading(), 'ALERTS UNAVAILABLE', raw)
  assert.equal(p.hasSuccessfulFetch, false)
}

const p = panel()
assert.equal(p.statusHeading(), 'CHECKING ALERTS')
p.located = false
assert.equal(p.statusHeading(), 'SET A LOCATION')
p.located = true
p.applyPayload(empty)
assert.equal(p.statusHeading(), 'NO MATCHING ALERTS')
assert.equal(p.hasSuccessfulFetch, true)
p.fetchInFlight = true
assert.equal(p.statusHeading(), 'UPDATING ALERTS')
p.fetchInFlight = false
p.applyPayload('')
assert.equal(p.statusHeading(), 'ALERTS UNAVAILABLE')
assert.match(p.heroMeta(), /current conditions unknown/)
assert.equal(p.lastUpdated, 'Sep 18 3:00 PM')
p.applyPayload(empty)
assert.equal(p.statusHeading(), 'NO MATCHING ALERTS')
assert.equal(p.fetchError, '')

// A failed check keeps the last payload, and drops it from the bar once the
// message itself has expired. The fixture's expires time is already past.
p.applyPayload(fixture)
assert.equal(p.statusHeading(), 'FLOOD ADVISORY')
const cached = p.incomingAlerts
for (const raw of ['', '{}', '{']) {
  p.applyPayload(raw)
  assert.equal(p.incomingAlerts, cached)
  assert.equal(p.alertCount, 0)
  assert.equal(p.heldExpired, true)
  assert.equal(p.statusHeading(), 'ALERTS UNAVAILABLE')
  assert.match(p.heroMeta(), /previous alerts have expired/)
}
p.fetchInFlight = true
p.requestExited = true
p.requestExitCode = 28 // curl timeout, even if stdout resembles valid data
p.responseBody = empty
p.responseReady = true
p.finishFetch()
assert.equal(p.fetchError, 'NWS is unreachable')
assert.equal(p.incomingAlerts, cached)
assert.match(p.footerText(), /last checked Sep 18 3:00 PM/)
p.applyPayload(empty)
assert.equal(p.alertCount, 0)
assert.equal(p.fetchError, '')

// Both callback orders must wait for a complete body AND a successful exit.
for (const first of ['stdout', 'exit']) {
  const q = panel()
  q.fetchInFlight = true
  if (first === 'stdout') {
    q.responseReady = true
    q.responseBody = empty
  } else {
    q.requestExited = true
    q.requestExitCode = 0
  }
  q.finishFetch()
  assert.equal(q.hasSuccessfulFetch, false)
  q.responseReady = true
  q.responseBody = empty
  q.requestExited = true
  q.requestExitCode = 0
  q.finishFetch()
  assert.equal(q.hasSuccessfulFetch, true)
}

// Old location responses and live responses received during demo are ignored.
for (const demoMode of [false, true]) {
  const q = panel()
  q.applyPayload(fixture)
  q.fetchInFlight = true
  q.demoMode = demoMode
  q.resetSource()
  assert.equal(q.hasSuccessfulFetch, false)
  assert.equal(q.alertCount, 0)
  assert.equal(q.lastUpdated, '')
  q.responseBody = fixture
  q.responseReady = true
  q.requestExited = true
  q.requestExitCode = 0
  q.finishFetch()
  assert.equal(q.alertCount, 0)
  assert.equal(q.hasSuccessfulFetch, false)
  assert.equal(q.fetchInFlight, false)
  assert.equal(q.refreshCalls, 2)
}

// A successful filtered result never claims that all weather is clear.
const filtered = panel()
filtered.filter = Model.parseFilter({})
filtered.applyPayload(fixture)
assert.equal(filtered.incomingAlerts.length, 1)
assert.equal(filtered.alertCount, 0)
assert.equal(filtered.statusHeading(), 'NO MATCHING ALERTS')

// Several alerts stay in the list. The selection survives a refresh, and the
// map copy names the other alerts. The bar label stays on the highest one.
const stack = panel()
stack.filter = Model.parseFilter({ showWarnings: true, showWatches: true, showAdvisories: true })
stack.applyPayload(JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'flood', event: 'Flood Warning', severity: 'Severe', urgency: 'Expected', expires: '2099-01-01T00:00:00Z', ends: '2099-01-02T00:00:00Z' } },
    { type: 'Feature', properties: { id: 'tor', event: 'Tornado Warning', severity: 'Extreme', urgency: 'Immediate', expires: '2099-01-01T01:00:00Z' } },
  ],
}))
assert.equal(stack.alerts[0].id, 'tor')
assert.equal(stack.alertCount, 2)
assert.equal(Model.barLabel(stack.alerts, false), '2 · TORNADO')
stack.selectedIndex = 1
stack.selectedId = 'flood'
stack.applyVisible()
assert.equal(stack.selected.id, 'flood')
assert.match(stack.heroMeta(), /other alert/)
stack.fetchError = 'NWS is unreachable'
stack.applyVisible()
assert.equal(stack.alertCount, 2)
assert.equal(stack.selected.id, 'flood')
assert.match(stack.heroMeta(), /showing last known data/)

// Notices wait until the seen-file has loaded, then fire once.
const notice = panel()
let notices = 0
notice._vm.notifyNewAlerts = () => { notices++ }
notice.seenHydrated = false
notice.applyPayload(JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'now', event: 'Tornado Warning', severity: 'Extreme', urgency: 'Immediate', expires: '2099-01-01T00:00:00Z' } },
  ],
}))
assert.equal(notices, 0)
assert.equal(notice.notifyWhenReady, true)
assert.equal(notice.firstLoad, true)
notice.seenHydrated = true
notice.releasePendingNotice()
assert.equal(notices, 1)
assert.equal(notice.firstLoad, false)
notice.releasePendingNotice()
assert.equal(notices, 1)

const memory = panel()
memory.seen = { kept: 50, newer: 80 }
memory.seenHydrated = true
memory.rememberSeen(JSON.stringify({ seen: { fromFile: 9, newer: 10 } }))
assert.equal(memory.seen.kept, 50)
assert.equal(memory.seen.newer, 80)
assert.equal(memory.seen.fromFile, 9)
console.log('panel state regression tests: ok')

// Failed/oversized/truncated transfers must never reach either parser, even
// when the partial stdout happens to contain a complete JSON document.
for (const zone of [false, true]) {
  for (const exitCode of [0, 18, 28, 63]) {
    for (const first of ['stdout', 'exit']) {
      const q = panel()
      let applied = 0
      let pumped = 0
      const fields = zone
        ? ['zoneFetchInFlight', 'zoneResponseReady', 'zoneRequestExited', 'zoneRequestExitCode', 'zoneResponseBody']
        : ['fetchInFlight', 'responseReady', 'requestExited', 'requestExitCode', 'responseBody']
      q[fields[0]] = true
      q[fields[1]] = false
      q[fields[2]] = false
      q[fields[3]] = -1
      q[fields[4]] = ''
      q[zone ? 'applyZonePayload' : 'applyPayload'] = () => { applied++ }
      q.pumpZones = () => { pumped++ }
      const finish = zone ? q.finishZoneFetch : q.finishFetch
      const stdout = () => { q[fields[1]] = true; q[fields[4]] = empty }
      const exit = () => { q[fields[2]] = true; q[fields[3]] = exitCode }
      ;(first === 'stdout' ? stdout : exit)()
      finish()
      assert.equal(applied, 0)
      assert.equal(pumped, 0)
      assert.equal(q[fields[0]], true)
      ;(first === 'stdout' ? exit : stdout)()
      finish()
      assert.equal(applied, exitCode === 0 ? 1 : 0)
      assert.equal(q[fields[4]], '')
      assert.equal(q[fields[0]], false)
      assert.equal(pumped, zone ? 1 : 0)
      finish()
      assert.equal(applied, exitCode === 0 ? 1 : 0)
    }
  }
}
const badZone = panel()
badZone.zoneFetchUrl = 'https://api.weather.gov/zones/forecast/OHZ010'
for (const raw of ['{', '{}', ' '.repeat(Model.responseByteLimit() + 1)]) {
  badZone.applyZonePayload(raw)
  assert.equal(Object.keys(badZone.zoneCache).length, 0)
}
console.log('transfer completion regression tests: ok')
