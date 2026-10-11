// Exercise the actual service's JavaScript handlers without a running desktop.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Model = require('../Model.js')
const source = fs.readFileSync(path.join(__dirname, '../Service.qml'), 'utf8')
const functions = [...source.matchAll(/^  function (\w+)\([^\n]*\) \{[\s\S]*?^  \}/gm)]
const fixture = fs.readFileSync(path.join(__dirname, 'nws-flood-advisory.json'), 'utf8')
const empty = JSON.stringify({ type: 'FeatureCollection', features: [] })
// The handlers are lifted out of the QML by pattern. If the file's layout
// changes, fail here and not by quietly testing nothing.
const found = functions.map(match => match[1])
for (const name of ['refresh', 'resetSource', 'finishFetch', 'abandonFetch', 'abandonZoneFetch', 'noteStaleness',
  'applyPayload', 'releasePendingNotice', 'rememberSeen', 'applyVisible', 'enqueueZones', 'pumpZones',
  'finishZoneFetch', 'applyZonePayload', 'notifyNewAlerts', 'persistSeen', 'sendNotice', 'statusHeading',
  'heroMeta', 'footerText']) {
  assert.ok(found.includes(name), `Service.qml handler not found: ${name}`)
}

// `live` keeps the real notification and seen-file handlers, with the
// notification command and the file write recorded instead of run.
function panel(options = {}) {
  const root = {
    demoMode: false, located: true, location: { name: 'Test town' },
    incomingAlerts: [], alerts: [], selectedIndex: 0,
    fetchError: '', fetchInFlight: false, hasSuccessfulFetch: false,
    fetchGeneration: 0, requestGeneration: 0, responseReady: false,
    requestExited: false, requestExitCode: -1, responseBody: '',
    zoneCache: {}, lastUpdated: '', firstLoad: true,
    filter: Model.parseFilter({ showAdvisories: true }),
    refreshCalls: 0, selectedId: '', heldExpired: false,
    seenHydrated: false, notifyWhenReady: false, zoneGeneration: 0, zoneRequestGeneration: 0,
    seen: {}, zoneFailures: {}, zoneFetchUrl: '', unreadableCount: 0, lastSuccessMs: 0,
    seenWritten: '', seenWrittenMs: 0, outsideCoverage: false, refreshMs: 60000,
    notices: [], writes: [],
  }
  Object.defineProperties(root, {
    selected: { get: () => root.alerts[root.selectedIndex] || null },
    alertCount: { get: () => root.alerts.length },
    filteredOut: { get: () => !root.demoMode && !root.heldExpired && root.incomingAlerts.length > 0 && !root.alerts.length },
  })
  const context = vm.createContext({
    root, Model,
    Qt: { formatDateTime: () => 'Sep 18 3:00 PM', callLater: fn => fn() },
    locationLabel: () => root.location.name,
    notifyNewAlerts: () => {}, persistSeen: () => {},
    fetchProc: { running: false }, zoneProc: { running: false },
    Quickshell: { execDetached: command => root.notices.push(command) },
    seenFile: { setText: text => root.writes.push(text) },
  })
  for (const match of functions) {
    vm.runInContext(match[0], context)
    root[match[1]] = context[match[1]]
  }
  if (!options.live) {
    context.notifyNewAlerts = () => {}
    context.persistSeen = () => {}
  }
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
// A routine refresh keeps the selected alert's details on screen.
stack.fetchInFlight = true
assert.match(stack.heroMeta(), /other alert/)
assert.doesNotMatch(stack.heroMeta(), /Checking NWS/)
stack.fetchInFlight = false
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
assert.equal(Model.seenTime(memory.seen.fromFile), 9)
// A point outside NWS coverage is a location problem, not an outage.
const abroad = panel()
abroad.fetchInFlight = true
abroad.requestExited = true
abroad.requestExitCode = 22
abroad.responseReady = true
abroad.responseBody = JSON.stringify({ title: 'Invalid Parameter', status: 400, detail: 'Parameter "point" is invalid: out of bounds' })
abroad.finishFetch()
assert.equal(abroad.outsideCoverage, true)
assert.equal(abroad.statusHeading(), 'OUTSIDE NWS COVERAGE')
assert.match(abroad.heroMeta(), /United States/)
const outage = panel()
outage.fetchInFlight = true
outage.requestExited = true
outage.requestExitCode = 22
outage.responseReady = true
outage.responseBody = JSON.stringify({ title: 'Unexpected Problem', status: 500, detail: 'An unexpected problem has occurred.' })
outage.finishFetch()
assert.equal(outage.outsideCoverage, false)
assert.equal(outage.fetchError, 'NWS is unreachable')

// One unreadable feature beside a warning: the warning shows, and the panel
// says something was left out.
const torFeature = JSON.parse(fs.readFileSync(path.join(__dirname, 'nws-tornado-update.json'), 'utf8')).features[0]
const partial = panel()
partial.applyPayload(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {} }, torFeature] }))
assert.equal(partial.statusHeading(), 'TORNADO WARNING')
assert.equal(partial.unreadableCount, 1)
assert.match(partial.footerText(), /1 alert could not be read/)
partial.applyPayload(empty)
assert.equal(partial.unreadableCount, 0)
assert.doesNotMatch(partial.footerText(), /could not be read/)

// A check that never reports back is abandoned, so the next one can start.
const stuck = panel()
stuck.applyPayload(empty)
stuck.fetchInFlight = true
stuck._vm.fetchProc.running = true
stuck.abandonFetch()
assert.equal(stuck.fetchInFlight, false)
assert.equal(stuck._vm.fetchProc.running, false)
assert.equal(stuck.fetchError, 'NWS check did not finish')
assert.equal(stuck.statusHeading(), 'ALERTS UNAVAILABLE')
stuck.abandonFetch()
assert.equal(stuck.fetchError, 'NWS check did not finish')
// Output arriving after that is ignored.
stuck.responseReady = true
stuck.requestExited = true
stuck.requestExitCode = 0
stuck.responseBody = fixture
stuck.finishFetch()
assert.equal(stuck.alertCount, 0)
assert.match(source, /interval: 15000\s+running: root.fetchInFlight\s+repeat: false\s+onTriggered: root.abandonFetch\(\)/)
assert.match(source, /interval: 15000\s+running: root.zoneFetchInFlight\s+repeat: false\s+onTriggered: root.abandonZoneFetch\(\)/)
// A check abandoned for a location that has since changed just asks again.
const moved = panel()
moved.fetchInFlight = true
moved.fetchGeneration = 1
moved.abandonFetch()
assert.equal(moved.fetchError, '')
assert.equal(moved.refreshCalls, 1)

// "Clear" expires when checks stop landing, and a new check is asked for.
const quiet = panel()
quiet.applyPayload(empty)
quiet.noteStaleness()
assert.equal(quiet.fetchError, '')
quiet.lastSuccessMs = Date.now() - 211000
quiet.noteStaleness()
assert.equal(quiet.fetchError, 'No recent NWS check')
assert.equal(quiet.statusHeading(), 'ALERTS UNAVAILABLE')
assert.equal(quiet.refreshCalls, 1)
quiet.applyPayload(empty)
assert.equal(quiet.fetchError, '')
assert.ok(Date.now() - quiet.lastSuccessMs < 5000)
assert.match(source, /interval: 10000\s+running: root.configured && root.hasSuccessfulFetch && !root.demoMode\s+repeat: true\s+onTriggered: root.noteStaleness\(\)/)

// The real notification path: seen-file, filters, and first load together.
const feature = (id, event, severity, urgency, extra) => ({ type: 'Feature', properties: Object.assign(
  { id, event, severity, urgency, headline: event + ' headline', expires: '2099-01-01T00:00:00Z' }, extra) })
const collection = (...features) => JSON.stringify({ type: 'FeatureCollection', features })
const live = panel({ live: true })
live.filter = Model.parseFilter({})
live.seenHydrated = true
// First load: only a warning that needs action now interrupts.
live.applyPayload(collection(
  feature('tor', 'Tornado Warning', 'Extreme', 'Immediate'),
  feature('wsw', 'Winter Storm Warning', 'Severe', 'Expected'),
  feature('watch', 'Tornado Watch', 'Severe', 'Immediate')))
assert.deepEqual(live.notices.map(command => command[7]), ['Tornado Warning'])
assert.deepEqual([...live.notices[0]].slice(0, 7), ['omarchy-notification-send', '--app-name', 'Acid Alerts', '-u', 'critical', '-g', live.alerts[0].icon])
assert.deepEqual([...live.notices[0]].slice(8), ['Tornado Warning headline', '--exec', 'omarchy-shell', 'shell', 'summon', 'neil.acid-alerts', '{}'])
assert.equal(live.firstLoad, false)
// Everything in the response is remembered, including what the filter hid.
assert.deepEqual(Object.keys(live.seen).sort(), ['tor', 'watch', 'wsw'])
assert.equal(live.writes.length, 1)
// The same response again: no notice, and no rewrite of an unchanged file.
live.applyPayload(collection(
  feature('tor', 'Tornado Warning', 'Extreme', 'Immediate'),
  feature('wsw', 'Winter Storm Warning', 'Severe', 'Expected'),
  feature('watch', 'Tornado Watch', 'Severe', 'Immediate')))
assert.equal(live.notices.length, 1)
assert.equal(live.writes.length, 1)
// After an hour the times are written again even with nothing new.
live.seenWrittenMs -= 3600001
live.applyPayload(collection(feature('tor', 'Tornado Warning', 'Extreme', 'Immediate'),
  feature('wsw', 'Winter Storm Warning', 'Severe', 'Expected'), feature('watch', 'Tornado Watch', 'Severe', 'Immediate')))
assert.equal(live.writes.length, 2)
// Later checks: a quiet update, an escalated update, a new warning, and a
// watch that the filter hides.
live.applyPayload(collection(
  feature('tor2', 'Tornado Warning', 'Extreme', 'Immediate', { references: [{ identifier: 'tor' }] }),
  feature('wsw2', 'Winter Storm Warning', 'Severe', 'Immediate', { references: [{ identifier: 'wsw' }] }),
  feature('ffw', 'Flash Flood Warning', 'Severe', 'Immediate'),
  feature('watch2', 'Severe Thunderstorm Watch', 'Severe', 'Future')))
assert.deepEqual(live.notices.slice(1).map(command => command[7]).sort(), ['Flash Flood Warning', 'Winter Storm Warning'])
assert.equal(live.writes.length, 3)
assert.deepEqual(JSON.parse(live.writes[2]).seen.tor2, { at: live.seen.tor2.at, event: 'Tornado Warning', rank: 4, urgency: 3, threat: 0 })
// A tornado warning raised to an emergency keeps its event and severity.
live.applyPayload(collection(feature('tor3', 'Tornado Warning', 'Extreme', 'Immediate',
  { references: [{ identifier: 'tor' }, { identifier: 'tor2' }], parameters: { tornadoDamageThreat: ['CATASTROPHIC'] } })))
assert.equal(live.notices.length, 4)
assert.equal(live.notices[3][7], 'Tornado Warning')
// Demo alerts never notify.
const demo = panel({ live: true })
demo.seenHydrated = true
demo.demoMode = true
demo.notifyNewAlerts([Model.normalizeAlert(feature('d', 'Tornado Warning', 'Extreme', 'Immediate'))])
assert.equal(demo.notices.length, 0)
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
for (const raw of ['{', '{}', ' '.repeat(Model.zoneByteLimit() + 1)]) {
  assert.equal(badZone.applyZonePayload(raw), false)
  assert.equal(Object.keys(badZone.zoneCache).length, 0)
}
// A zone with nothing to draw, a failed transfer, and one that never reports
// back are each remembered, so the next check does not ask again at once.
const zoneUrl = 'https://api.weather.gov/zones/county/FLC087'
for (const failure of ['unreadable', 'transfer', 'stuck']) {
  const q = panel()
  q.pumpZones = () => {}
  q.zoneFetchUrl = zoneUrl
  q.zoneFetchInFlight = true
  if (failure === 'stuck') {
    q.abandonZoneFetch()
  } else {
    q.zoneResponseReady = true
    q.zoneRequestExited = true
    q.zoneRequestExitCode = failure === 'transfer' ? 63 : 0
    q.zoneResponseBody = '{}'
    q.finishZoneFetch()
  }
  assert.equal(q.zoneFetchInFlight, false, failure)
  assert.equal(q.zoneFailures[zoneUrl].count, 1, failure)
  const waiting = [{ zoneUrls: [zoneUrl], rings: [], polygons: [] }]
  assert.deepEqual(Model.missingZoneUrls(waiting, q.zoneCache, q.zoneFailures, Date.now()), [], failure)
  assert.deepEqual(Model.missingZoneUrls(waiting, q.zoneCache, q.zoneFailures, Date.now() + 301000), [zoneUrl], failure)
}
// The captured GeometryCollection county loads and is not counted as failed.
const keys = panel()
keys.pumpZones = () => {}
keys.zoneFetchUrl = zoneUrl
keys.incomingAlerts = [Model.normalizeAlert({ properties: { id: 'keys', event: 'Hurricane Warning', severity: 'Extreme', affectedZones: [zoneUrl] } })]
keys.filter = Model.parseFilter({})
keys.zoneFetchInFlight = true
keys.zoneResponseReady = true
keys.zoneRequestExited = true
keys.zoneRequestExitCode = 0
keys.zoneResponseBody = fs.readFileSync(path.join(__dirname, 'nws-zone-geometry-collection.json'), 'utf8')
keys.finishZoneFetch()
assert.deepEqual(Object.keys(keys.zoneFailures), [])
assert.ok(keys.zoneCache[zoneUrl].length >= 4)
assert.equal(keys.alerts[0].geometryKind, 'zone')
assert.equal(keys.alerts[0].zonesDrawn, 1)
console.log('transfer completion regression tests: ok')

// Cached alerts age out independently of network completion.
const aging = panel()
aging.incomingAlerts = [Model.normalizeAlert({ properties: {
  id: 'aging', event: 'Tornado Warning', severity: 'Extreme',
  expires: '2099-01-01T00:00:00Z',
} })]
aging.fetchError = 'NWS is unreachable'
aging.applyVisible()
assert.equal(aging.alertCount, 1)
aging.incomingAlerts[0].expires = '2000-01-01T00:00:00Z'
aging.applyVisible()
assert.equal(aging.alertCount, 0)
assert.equal(aging.heldExpired, true)
assert.equal(aging.filteredOut, false)
assert.match(source, /interval: 1000\s+running: !root.demoMode && root.fetchError !== "" && root.alertCount > 0\s+repeat: true\s+onTriggered: root.applyVisible\(\)/)

// The bar builds a widget and panel per monitor. Only the shared service may
// poll NWS or send notifications, or each monitor repeats them.
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'))
assert.ok(manifest.kinds.includes('service'))
assert.equal(manifest.entryPoints.service, 'Service.qml')
for (const file of ['BarWidget.qml', 'Panel.qml']) {
  const view = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  assert.doesNotMatch(view, /\bProcess\s*\{|execDetached|FileView\s*\{/, file)
}
console.log('single shared service: ok')
