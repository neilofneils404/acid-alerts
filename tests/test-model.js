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
assert.ok(Model.alertsUrl(location).indexOf("point=41.27255") !== -1)

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
assert.strictEqual(seen["urn:1"], 100)

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
assert.strictEqual(Model.eventIcon("High Wind Warning"), "")
assert.strictEqual(Model.eventIcon("Dense Fog Advisory"), "")

assert.strictEqual(Model.eventClass("Tornado Warning"), "warning")
assert.strictEqual(Model.eventClass("Tornado Watch"), "watch")
assert.strictEqual(Model.eventClass("Heat Advisory"), "advisory")
assert.strictEqual(Model.eventClass("Flash Flood Statement"), "warning")
assert.strictEqual(Model.eventClass("Severe Weather Statement"), "warning")
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

console.log("ok")

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
