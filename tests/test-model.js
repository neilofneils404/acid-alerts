const assert = require("assert")
const fs = require("fs")
const path = require("path")
const Model = require("../Model.js")

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "nws-flood-advisory.json"), "utf8"))

const parsed = Model.parseCollection(JSON.stringify(fixture))
assert.strictEqual(parsed.error, "")
assert.strictEqual(parsed.alerts.length, 1)
const alert = parsed.alerts[0]
assert.strictEqual(alert.event, "Flood Advisory")
assert.strictEqual(alert.shortEvent, "FLOOD ADV")
assert.strictEqual(alert.rank, 1)
assert.ok(alert.rings.length >= 1)
assert.strictEqual(alert.instruction.includes("Turn around"), true)

const empty = Model.parseCollection(JSON.stringify({ type: "FeatureCollection", features: [] }))
assert.strictEqual(empty.alerts.length, 0)

const location = Model.parseLocation(JSON.stringify({
  name: "Grafton",
  latitude: 41.27255,
  longitude: -82.05459
}), {})
assert.strictEqual(location.source, "weather")
assert.strictEqual(Model.hasCoordinates(location), true)
// The point is sent at four decimals, never in exponent form.
assert.strictEqual(Model.alertsUrl(location), "https://api.weather.gov/alerts/active?point=41.2726,-82.0546")
assert.strictEqual(Model.alertsUrl({ latitude: 1e-7, longitude: -82 }), "https://api.weather.gov/alerts/active?point=0,-82")

// A blank, null, or half-filled override is no override. None of them may
// become 0, 0, and an unset location is not a location.
const weather = JSON.stringify({ name: "Grafton", latitude: 41.27255, longitude: -82.05459 })
for (const blank of [
  { latitude: "", longitude: "", name: "" },
  { latitude: null, longitude: null },
  { latitude: "41.3", longitude: "" },
  { latitude: " ", longitude: "-82" },
  { latitude: true, longitude: false },
  { latitude: "north", longitude: "west" },
  { latitude: 91, longitude: 0 },
]) {
  assert.strictEqual(Model.parseLocation(weather, blank).source, "weather", JSON.stringify(blank))
}
assert.strictEqual(Model.parseLocation(weather, { latitude: "27.8", longitude: " -97.4 " }).longitude, -97.4)
assert.strictEqual(Model.parseLocation(weather, { latitude: 0, longitude: 0 }).source, "settings")
for (const raw of ["", "{}", '{"latitude":null,"longitude":null}', '{"latitude":"","longitude":""}']) {
  const unset = Model.parseLocation(raw, {})
  assert.strictEqual(unset.latitude, null, raw)
  assert.strictEqual(Model.hasCoordinates(unset), false, raw)
  assert.strictEqual(Model.alertsUrl(unset), "", raw)
}

const override = Model.parseLocation("{}", { latitude: 27.8, longitude: -97.4, name: "Corpus" })
assert.strictEqual(override.source, "settings")
assert.strictEqual(override.name, "Corpus")

assert.strictEqual(Model.barLabel([], false), "")
assert.strictEqual(Model.barLabel(parsed.alerts, false), "FLOOD ADV")
assert.strictEqual(Model.barLabel(parsed.alerts.concat(parsed.alerts), false), "2 · FLOOD ADV")

assert.strictEqual(Model.shouldNotify(alert, {}, true), false)
assert.strictEqual(Model.shouldNotify({ id: "w", event: "Tornado Warning", rank: 3, urgencyRank: 3 }, {}, true), true)
assert.strictEqual(Model.shouldNotify({ id: "heat", rank: 3, urgencyRank: 2 }, {}, true), false)
assert.strictEqual(Model.shouldNotify({ id: "heat", rank: 3, urgencyRank: 2 }, {}, false), true)
assert.strictEqual(Model.shouldNotify({ id: "w", event: "Tornado Warning", rank: 3, urgencyRank: 3 }, { w: 1 }, false), false)
assert.strictEqual(Model.leadUrgent({ event: "Freeze Warning", rank: 2 }), true)
assert.strictEqual(Model.leadUrgent({ event: "Flood Advisory", rank: 1 }), false)

const bounds = Model.boundsFor(alert.rings, 27.8, -97.4, 0.2)
assert.ok(bounds)
const inside = Model.pointInRings(alert.rings[0][0][0], alert.rings[0][0][1], alert.rings)
assert.strictEqual(typeof inside, "boolean")
const cells = Model.rasterCells(alert.polygons, bounds, 24, 16)
assert.ok(cells.length > 0)

const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
const west = square(0, 0, 2, 2)
const east = square(3, 0, 5, 2)
const bothBounds = Model.boundsFor([west, east], 1, 2.5, 0)
assert.strictEqual(Model.pointInPolygons(1, 1, [[west], [east]]), true)
assert.strictEqual(Model.pointInPolygons(4, 1, [[west], [east]]), true)
assert.strictEqual(Model.pointInPolygons(2.5, 1, [[west], [east]]), false)
const bothCells = Model.rasterCells([[west], [east]], bothBounds, 40, 20)
const westCells = Model.rasterCells([[west]], bothBounds, 40, 20)
assert.ok(bothCells.length > westCells.length, "second polygon is filled, not a hole")
const outer = square(0, 0, 4, 4)
const hole = square(1, 1, 2, 2)
const holeBounds = Model.boundsFor([outer], 2, 2, 0)
assert.strictEqual(Model.pointInPolygons(0.5, 0.5, [[outer, hole]]), true)
assert.strictEqual(Model.pointInPolygons(1.5, 1.5, [[outer, hole]]), false)
assert.ok(Model.rasterCells([[outer, hole]], holeBounds, 30, 30).length < Model.rasterCells([[outer]], holeBounds, 30, 30).length)

const degree = [[[-81.7, 41.4], [-81.6, 41.4], [-81.6, 41.5], [-81.7, 41.5], [-81.7, 41.4]]]
const framed = Model.boundsFor(degree, 41.45, -81.65, 0)
const westEdge = Model.project(-81.7, 41.45, framed, 200, 200)
const eastEdge = Model.project(-81.6, 41.45, framed, 200, 200)
const southEdge = Model.project(-81.65, 41.4, framed, 200, 200)
const northEdge = Model.project(-81.65, 41.5, framed, 200, 200)
assert.ok(Math.abs(northEdge.y - southEdge.y) > Math.abs(eastEdge.x - westEdge.x))

const seen = Model.parseSeen(Model.serializeSeen({ "urn:1": 100 }))
assert.deepStrictEqual(seen["urn:1"], { at: 100, event: "", rank: 0, urgency: 3, threat: 3 })

// NWS gives every update a new id and lists the messages it replaces.
// An update to something already announced stays quiet.
const original = Model.normalizeAlert({ properties: {
  id: "urn:a", event: "Winter Storm Warning", severity: "Severe", urgency: "Expected",
} })
const remembered = Model.mergeSeen({}, [original], 1000, 172800000)
assert.deepStrictEqual(remembered["urn:a"], { at: 1000, event: "Winter Storm Warning", rank: 3, urgency: 2, threat: 0 })
assert.deepStrictEqual(Model.parseSeen(Model.serializeSeen(remembered)), remembered)
const update = Model.normalizeAlert({ properties: {
  id: "urn:b", event: "Winter Storm Warning", severity: "Severe", urgency: "Expected",
  messageType: "Update",
  references: [{ "@id": "https://api.weather.gov/alerts/urn:a", identifier: "urn:a", sender: "w-nws.webmaster@noaa.gov", sent: "2026-01-01T00:00:00-05:00" }],
} })
assert.deepStrictEqual(update.references, ["urn:a"])
assert.strictEqual(Model.shouldNotify(update, remembered, false), false)
assert.strictEqual(Model.shouldNotify(update, {}, false), true)
// A severity increase still interrupts.
assert.strictEqual(Model.shouldNotify(Object.assign({}, update, { rank: 4 }), remembered, false), true)
// A watch upgraded to a warning is a different event, so it notifies.
const watchSeen = Model.mergeSeen({}, [{ id: "urn:w", event: "Winter Storm Watch", rank: 3 }], 1000, 172800000)
assert.strictEqual(Model.shouldNotify(Object.assign({}, update, { references: ["urn:w"] }), watchSeen, false), true)
// Entries from older seen-files carry no event, so they never hide an update.
assert.strictEqual(Model.shouldNotify(update, Model.parseSeen('{"seen":{"urn:a":1000}}'), false), true)

const Demo = require("../Demo.js")
assert.strictEqual(Demo.demoEnabled({ demo: true }), true)
assert.strictEqual(Demo.demoEnabled({ demo: "true" }), true)
assert.strictEqual(Demo.demoEnabled({}), false)
assert.strictEqual(Model.eventIcon("Tornado Warning"), "")
assert.strictEqual(Model.eventIcon("Winter Storm Warning"), "")
assert.strictEqual(Model.eventIcon("Ice Storm Warning"), "")
assert.strictEqual(Model.shortEvent("Winter Storm Warning"), "WINTER")
assert.strictEqual(Model.shortEvent("Ice Storm Warning"), "ICE STORM")
assert.strictEqual(Model.shortEvent("Snow Squall Warning"), "SNOW SQUALL")
assert.strictEqual(Model.shortEvent("High Wind Warning"), "HIGH WIND")
assert.strictEqual(Model.shortEvent("Dense Fog Advisory"), "FOG")
assert.strictEqual(Model.shortEvent("Lake Wind Advisory"), "LAKE WIND")
assert.strictEqual(Model.shortEvent("Fire Weather Watch"), "FIRE WATCH")
// Events outside the table keep their class and whole words.
assert.strictEqual(Model.shortEvent("Freeze Watch"), "FREEZE WATCH")
assert.strictEqual(Model.shortEvent("Tsunami Watch"), "TSUNAMI WATCH")
assert.strictEqual(Model.shortEvent("Tsunami Advisory"), "TSUNAMI ADV")
assert.strictEqual(Model.shortEvent("Hazardous Seas Watch"), "HAZ SEAS WATCH")
assert.strictEqual(Model.shortEvent("Lakeshore Flood Watch"), "LKSHR WATCH")
assert.strictEqual(Model.shortEvent("Some Very Long Unlisted Hazard Warning"), "SOME VERY LONG")
assert.strictEqual(Model.shortEvent(""), "ALERT")
assert.strictEqual(Model.eventIcon("High Wind Warning"), "")
assert.strictEqual(Model.eventIcon("Dense Fog Advisory"), "")

assert.strictEqual(Model.eventClass("Tornado Warning"), "warning")
assert.strictEqual(Model.eventClass("Tornado Watch"), "watch")
assert.strictEqual(Model.eventClass("Heat Advisory"), "advisory")
assert.strictEqual(Model.eventClass("Flash Flood Statement"), "warning")
assert.strictEqual(Model.eventClass("Severe Weather Statement"), "warning")
// Emergency products are warnings even without the suffix.
assert.strictEqual(Model.eventClass("Evacuation Immediate"), "warning")
assert.strictEqual(Model.eventClass("Civil Emergency Message"), "warning")
assert.strictEqual(Model.eventClass("Local Area Emergency"), "warning")
assert.strictEqual(Model.matchesFilter({ event: "Evacuation Immediate" }, Model.parseFilter({})), true)
assert.strictEqual(Model.eventClass("Special Weather Statement"), "advisory")
assert.strictEqual(Model.familyOf("Typhoon Warning"), "tropical")
assert.strictEqual(Model.familyOf("Hurricane Force Wind Warning"), "wind")
assert.strictEqual(Model.familyOf("Hurricane Warning"), "tropical")
assert.strictEqual(Model.familyOf("Tsunami Warning"), "other")
assert.strictEqual(Model.matchesFilter({ event: "Flash Flood Statement" }, Model.parseFilter({})), true)
assert.strictEqual(Model.familyOf("Severe Weather Statement"), "thunderstorm")
assert.strictEqual(Model.familyOf("Ice Storm Warning"), "winter")
assert.strictEqual(Model.familyOf("Tornado Watch"), "tornado")

const defaults = Model.parseFilter({})
assert.strictEqual(defaults.warnings, true)
assert.strictEqual(defaults.watches, false)
assert.strictEqual(defaults.advisories, false)
assert.strictEqual(defaults.families.length, 0)

const tornadoOnly = Model.parseFilter({
  showWarnings: true,
  showWatches: false,
  families: ["tornado"]
})
assert.strictEqual(Model.matchesFilter({ event: "Tornado Warning" }, tornadoOnly), true)
assert.strictEqual(Model.matchesFilter({ event: "Tornado Watch" }, tornadoOnly), false)
assert.strictEqual(Model.matchesFilter({ event: "Flash Flood Warning" }, tornadoOnly), false)
assert.strictEqual(Model.matchesFilter({ event: "Winter Storm Warning" }, tornadoOnly), false)

const watchesOn = Model.parseFilter({ showWarnings: true, showWatches: true })
assert.strictEqual(Model.matchesFilter({ event: "Tornado Watch" }, watchesOn), true)
assert.strictEqual(Model.footprintCaption("polygon"), "NWS storm-based polygon")
assert.strictEqual(Model.footprintCaption("zone"), "NWS county / zone outline")

const atlas = Model.parseZoneAtlas(fs.readFileSync(path.join(__dirname, "../demo/zones.json"), "utf8"))
assert.ok(atlas.OHC093 && atlas.OHC093[0].length > 10)
assert.ok(atlas.OHZ010)

const scenes = Demo.scenes(atlas)
assert.ok(scenes.length >= 16)
const titles = scenes.map((scene) => scene.title)
assert.ok(titles.indexOf("Tornado Warning") !== -1)
assert.ok(titles.indexOf("Winter Storm Warning") !== -1)
assert.ok(titles.indexOf("Ice Storm Warning") !== -1)
assert.ok(titles.indexOf("Blizzard Warning") !== -1)
assert.ok(titles.indexOf("Snow Squall Warning") !== -1)
for (var i = 0; i < scenes.length; i++) {
  const demoParsed = Model.parseCollection(JSON.stringify({
    type: "FeatureCollection",
    features: scenes[i].features
  }))
  assert.strictEqual(demoParsed.error, "")
  assert.ok(demoParsed.alerts.length >= 1, scenes[i].id)
  if (scenes[i].id === "winter-storm-warning") {
    assert.ok(demoParsed.alerts[0].rings.length >= 1, "winter warning uses NWS zone outline")
    assert.strictEqual(demoParsed.alerts[0].geometryKind, "zone")
  }
  if (scenes[i].id === "tornado-warning") {
    assert.strictEqual(demoParsed.alerts[0].geometryKind, "polygon")
  }
  if (scenes[i].id === "winter-storm-watch") {
    assert.ok(demoParsed.alerts[0].polygons.length >= 2, "watch covers more than one county")
    const watchBounds = Model.boundsFor(demoParsed.alerts[0].rings, 41.5, -81.7, 0.05)
    const watchCells = Model.rasterCells(demoParsed.alerts[0].polygons, watchBounds, 48, 32)
    const firstCounty = Model.rasterCells([demoParsed.alerts[0].polygons[0]], watchBounds, 48, 32)
    assert.ok(watchCells.length > firstCounty.length)
  }
}

const skipped = Model.parseCollection(JSON.stringify({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { event: "Required Weekly Test", status: "Test", severity: "Minor", id: "test" } },
    { type: "Feature", properties: { event: "Tornado Warning", status: "Actual", severity: "Extreme", urgency: "Immediate", id: "tw" } }
  ]
}))
assert.strictEqual(skipped.error, "")
assert.strictEqual(skipped.alerts.length, 1)
assert.strictEqual(skipped.alerts[0].event, "Tornado Warning")
assert.strictEqual(skipped.alerts[0].shortEvent, "TORNADO")

const future = Date.parse("2099-01-01T00:00:00Z")
const past = Date.parse("2000-01-01T00:00:00Z")
const kept = Model.unexpired([
  { id: "live", expires: "2099-01-01T00:00:00Z" },
  { id: "old", expires: "2000-01-01T00:00:00Z" },
  { id: "open" }
], Date.now())
assert.deepStrictEqual(kept.map((item) => item.id), ["live", "open"])
assert.ok(future > past)

// Partial zone downloads must keep growing the footprint and retry missing zones.
const zoneA = "https://api.weather.gov/zones/county/OHC035"
const zoneB = "https://api.weather.gov/zones/county/OHC093"
const zoneAlert = { zoneUrls: [zoneA, zoneB], rings: [], polygons: [] }
const zoneCache = { [zoneA]: [[west]] }
Model.attachZoneRings([zoneAlert], zoneCache)
assert.equal(zoneAlert.polygons.length, 1)
assert.deepEqual(Model.missingZoneUrls([zoneAlert], zoneCache), [zoneB])
zoneCache[zoneB] = [[east]]
Model.attachZoneRings([zoneAlert], zoneCache)
assert.equal(zoneAlert.polygons.length, 2)
Model.attachZoneRings([zoneAlert], zoneCache)
assert.equal(zoneAlert.polygons.length, 2, "reattaching does not duplicate polygons")
const storm = { geometryKind: "polygon", rings: [west], polygons: [[west]], zoneUrls: [zoneB] }
Model.attachZoneRings([storm], zoneCache)
assert.equal(storm.polygons.length, 1, "issued storm geometry is preserved")
assert.equal(Model.shouldNotify({ id: "watch", event: "Tornado Watch", rank: 3, urgencyRank: 3 }, {}, true), false)
assert.strictEqual(Model.noticeUrgency({ event: "Tornado Warning", rank: 4 }), "critical")
assert.strictEqual(Model.noticeUrgency({ event: "Evacuation Immediate", rank: 4 }), "critical")
assert.strictEqual(Model.noticeUrgency({ event: "Tornado Watch", rank: 3 }), "normal")
assert.strictEqual(Model.noticeUrgency({ event: "Flood Warning", rank: 2 }), "normal")

// The manifest describes the same settings the code reads.
const manifest = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "../manifest.json"), "utf8"))
const widgetDefaults = manifest.barWidget.defaults
const filterDefaults = Model.parseFilter({})
assert.strictEqual(widgetDefaults.showWarnings, filterDefaults.warnings)
assert.strictEqual(widgetDefaults.showWatches, filterDefaults.watches)
assert.strictEqual(widgetDefaults.showAdvisories, filterDefaults.advisories)
assert.deepStrictEqual(widgetDefaults.families, filterDefaults.families)
const familyField = manifest.barWidget.schema.find(field => field.key === "families")
assert.deepStrictEqual(familyField.options.map(option => option.value), Model.familyOptions().map(option => option.id))
for (const field of manifest.barWidget.schema) {
  if (field.key in widgetDefaults && "defaultValue" in field) assert.deepStrictEqual(field.defaultValue, widgetDefaults[field.key], field.key)
}

// An update is compared with the message it most recently replaced. A warning
// that eased and then worsened again notifies; so does a rise in urgency or
// in the damage threat tag. An unchanged update stays quiet.
const chain = Model.mergeSeen(
  Model.mergeSeen({}, [{ id: "a", event: "Flood Warning", rank: 4, urgencyRank: 2 }], 1000),
  [{ id: "b", event: "Flood Warning", rank: 3, urgencyRank: 2 }], 2000)
const next = (fields) => Object.assign({ id: "c", event: "Flood Warning", rank: 3, urgencyRank: 2, threat: 0, references: ["a", "b"] }, fields)
assert.strictEqual(Model.shouldNotify(next({}), chain, false), false)
assert.strictEqual(Model.shouldNotify(next({ rank: 4 }), chain, false), true)
assert.strictEqual(Model.shouldNotify(next({ urgencyRank: 3 }), chain, false), true)
assert.strictEqual(Model.shouldNotify(next({ threat: 1 }), chain, false), true)
// Entries written before urgency and threat were stored never re-announce.
const legacy = Model.parseSeen('{"seen":{"b":{"at":2000,"event":"Flood Warning","rank":3}}}')
assert.strictEqual(Model.shouldNotify(next({ urgencyRank: 3, threat: 3, references: ["b"] }), legacy, false), false)
assert.strictEqual(Model.threatRank({ parameters: { tornadoDamageThreat: ["CATASTROPHIC"] } }), 3)
assert.strictEqual(Model.threatRank({ parameters: { thunderstormDamageThreat: ["considerable"], flashFloodDamageThreat: ["Destructive"] } }), 2)
assert.strictEqual(Model.threatRank({ parameters: { tornadoDetection: ["RADAR INDICATED"] } }), 0)
assert.strictEqual(Model.threatRank({}), 0)
assert.strictEqual(Model.seenSignature(chain), Model.seenSignature(Model.mergeSeen(chain, [], 999999)))
assert.notStrictEqual(Model.seenSignature(chain), Model.seenSignature(Model.mergeSeen(chain, [{ id: "d", event: "Flood Warning", rank: 3 }], 3000)))

// Captured NWS updates: a storm-based warning and a zone-only warning.
const read = (name) => fs.readFileSync(path.join(__dirname, name), "utf8")
const torUpdate = Model.parseCollection(read("nws-tornado-update.json"))
assert.strictEqual(torUpdate.error, "")
const tor = torUpdate.alerts[0]
assert.strictEqual(tor.event, "Tornado Warning")
assert.strictEqual(tor.geometryKind, "polygon")
assert.strictEqual(tor.references.length, 1)
assert.strictEqual(tor.threat, 0)
assert.strictEqual(Model.noticeUrgency(tor), "critical")
const torSeen = Model.mergeSeen({}, [Object.assign({}, tor, { id: tor.references[0] })], 1000)
assert.strictEqual(Model.shouldNotify(tor, {}, true), true)
assert.strictEqual(Model.shouldNotify(tor, torSeen, false), false)
assert.strictEqual(Model.shouldNotify(Object.assign({}, tor, { threat: 3 }), torSeen, false), true)
const freeze = Model.parseCollection(read("nws-freeze-update.json")).alerts[0]
assert.strictEqual(freeze.event, "Freeze Warning")
assert.strictEqual(freeze.rings.length, 0)
assert.strictEqual(freeze.zoneUrls.length, 2)
assert.strictEqual(freeze.zoneTotal, 2)
assert.strictEqual(Model.footprintCaption(freeze.geometryKind), "No footprint in this product")

// One damaged feature is counted and left out; the warning beside it stays.
const partial = Model.parseCollection(JSON.stringify({
  type: "FeatureCollection",
  features: [null, { type: "Feature", properties: {} }, JSON.parse(read("nws-tornado-update.json")).features[0]]
}))
assert.strictEqual(partial.error, "")
assert.strictEqual(partial.unreadable, 2)
assert.strictEqual(partial.alerts.length, 1)
assert.strictEqual(Model.parseCollection(JSON.stringify({ type: "FeatureCollection", features: [] })).unreadable, 0)

// A county published as a GeometryCollection still yields an outline.
const keys = Model.parseZoneDocument(read("nws-zone-geometry-collection.json"))
assert.ok(keys.length >= 4, "every member of the collection contributes")
assert.ok(Model.rasterCells(keys, Model.boundsFor(Model.flattenPolygons(keys), 24.6, -81.6, 0.2), 119, 42).length > 0)
// Hundreds of islands are cut to the largest, and the big one survives.
const islands = []
for (let n = 0; n < 300; n++) islands.push([square(n, 0, n + 0.01, 0.01)])
islands.push([square(0, 10, 50, 60)])
const cut = Model.parseZoneDocument(JSON.stringify({ geometry: { type: "MultiPolygon", coordinates: islands } }))
assert.strictEqual(cut.length, 64)
assert.strictEqual(cut[0][0][2][1], 60)

// Filling by bounding box gives the same cells as testing every cell.
const everyCell = (polygons, b, columns, rows) => {
  const out = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const geo = Model.unproject(col + 0.5, row + 0.5, b, columns, rows)
    if (geo && Model.pointInPolygons(geo.lon, geo.lat, polygons)) out.push(row * columns + col)
  }
  return out
}
for (const shapes of [[[west], [east]], [[outer, hole]], keys, [[outer], [west]]]) {
  const b = Model.boundsFor(Model.flattenPolygons(shapes), NaN, NaN, 0.2)
  assert.deepStrictEqual(Model.rasterCells(shapes, b, 60, 40), everyCell(shapes, b, 60, 40))
}

// A watch names more zones than are drawn, and the caption says how many.
const manyZones = []
for (let n = 1; n <= 40; n++) manyZones.push("https://api.weather.gov/zones/county/OHC" + String(n).padStart(3, "0"))
const wide = Model.normalizeAlert({ properties: { id: "wide", event: "Tornado Watch", affectedZones: manyZones } })
assert.strictEqual(wide.zoneUrls.length, 24)
assert.strictEqual(wide.zoneTotal, 40)
const wideCache = {}
for (const url of wide.zoneUrls.slice(0, 3)) wideCache[url] = [[west]]
Model.attachZoneRings([wide], wideCache)
assert.strictEqual(wide.zonesDrawn, 3)
assert.strictEqual(Model.footprintCaption(wide.geometryKind, wide.zonesDrawn, wide.zoneTotal), "NWS county / zone outline · 3 of 40 zones drawn")
assert.strictEqual(Model.footprintCaption("zone", 2, 2), "NWS county / zone outline")
// Only api.weather.gov zone paths are ever fetched.
assert.deepStrictEqual(Model.extractZoneUrls({ affectedZones: [
  "http://api.weather.gov/zones/county/OHC035", "https://example.com/zones/county/OHC035",
  "https://api.weather.gov/zones/county/OHC{035,093}", "https://api.weather.gov/zones/county/../../alerts",
  zoneA,
] }), [zoneA])

// A zone that fails is not asked for again until its delay has passed.
assert.strictEqual(Model.zoneRetryDelayMs(1), 300000)
assert.strictEqual(Model.zoneRetryDelayMs(2), 600000)
assert.strictEqual(Model.zoneRetryDelayMs(99), 21600000)
const waiting = { zoneUrls: [zoneA, zoneB], rings: [], polygons: [] }
let failures = Model.noteZoneFailure({}, zoneB, 1000)
assert.deepStrictEqual(Model.missingZoneUrls([waiting], {}, failures, 2000), [zoneA])
assert.deepStrictEqual(Model.missingZoneUrls([waiting], {}, failures, 1000 + 300000), [zoneA, zoneB])
failures = Model.noteZoneFailure(failures, zoneB, 400000)
assert.strictEqual(failures[zoneB].count, 2)
assert.strictEqual(failures[zoneB].retryAt, 400000 + 600000)

// Alerts ending at the same rank sort by the instant they expire, whatever
// UTC offset each office wrote.
const eastern = { rank: 3, urgencyRank: 2, expires: "2026-10-10T23:00:00-05:00", event: "A", id: "1" }
const atlantic = { rank: 3, urgencyRank: 2, expires: "2026-10-10T22:30:00-04:00", event: "B", id: "2" }
assert.ok(Model.compareAlerts(atlantic, eastern) < 0)
assert.ok(Model.compareAlerts(eastern, atlantic) > 0)

// Marine wind products are wind, and "ice" is matched as a word.
assert.strictEqual(Model.familyOf("Gale Warning"), "wind")
assert.strictEqual(Model.familyOf("Storm Warning"), "wind")
assert.strictEqual(Model.familyOf("Winter Storm Warning"), "winter")
assert.strictEqual(Model.familyOf("Storm Surge Warning"), "flood")
assert.strictEqual(Model.familyOf("Service Notice"), "other")
assert.strictEqual(Model.familyOf("Ice Storm Warning"), "winter")
// Names that are also Object.prototype members are just unlisted events.
assert.strictEqual(Model.shortEvent("constructor"), "CONSTRUCTOR")
assert.strictEqual(typeof Model.eventIcon("toString"), "string")
assert.strictEqual(Model.shouldNotify({ id: "constructor", event: "Tornado Warning", rank: 4, urgencyRank: 3 }, {}, false), true)

assert.strictEqual(Model.clampRefreshSeconds(60), 60)
assert.strictEqual(Model.clampRefreshSeconds("5"), 30)
assert.strictEqual(Model.clampRefreshSeconds("soon"), 60)
assert.strictEqual(Model.clampRefreshSeconds(1e12), 86400)
assert.strictEqual(Model.isStale(0, 1e9, 60000), false)
assert.strictEqual(Model.isStale(1000, 1000 + 210000, 60000), false)
assert.strictEqual(Model.isStale(1000, 1000 + 210001, 60000), true)

console.log("model tests: ok")
