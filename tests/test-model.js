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
assert.strictEqual(alert.shortEvent, "FLOOD")
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
assert.strictEqual(Model.barLabel(parsed.alerts, false), "FLOOD")
assert.strictEqual(Model.barLabel(parsed.alerts.concat(parsed.alerts), false), "2 · FLOOD")

assert.strictEqual(Model.shouldNotify(alert, {}, true), false)
assert.strictEqual(Model.shouldNotify({ id: "w", rank: 3, urgencyRank: 3 }, {}, true), true)
assert.strictEqual(Model.shouldNotify({ id: "w", rank: 3, urgencyRank: 3 }, { w: 1 }, false), false)

const bounds = Model.boundsFor(alert.rings, 27.8, -97.4, 0.2)
assert.ok(bounds)
const inside = Model.pointInRings(alert.rings[0][0][0], alert.rings[0][0][1], alert.rings)
assert.strictEqual(typeof inside, "boolean")
const cells = Model.rasterCells(alert.rings, bounds, 24, 16)
assert.ok(cells.length > 0)

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
}

console.log("ok")
