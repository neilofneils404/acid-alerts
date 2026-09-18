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

// Preserve cached alerts and timestamps across network and parsing failures.
p.applyPayload(fixture)
const cached = p.incomingAlerts
for (const raw of ['', '{}', '{']) {
  p.applyPayload(raw)
  assert.equal(p.incomingAlerts, cached)
  assert.equal(p.statusHeading(), 'FLOOD ADVISORY')
  assert.match(p.heroMeta(), /showing last known data/)
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
console.log('panel state regression tests: ok')
