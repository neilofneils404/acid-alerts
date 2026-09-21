// Local gallery of NWS product types for screenshot and layout testing.
// Shapes sit around Cleveland so the footprint map is readable; copy is
// official-style instruction language, not a live product.

var CLEVELAND = { lat: 41.4993, lon: -81.6944 }

function demoEnabled(settings) {
  if (!settings || typeof settings !== "object") return false
  var value = settings.demo
  if (value === true || value === 1) return true
  if (typeof value === "string") {
    var text = value.replace(/^\s+|\s+$/g, "").toLowerCase()
    return text === "true" || text === "1" || text === "yes"
  }
  return false
}

function scenes(atlas) {
  var cuyahogaCounty = geomFromAtlas(atlas, ["OHC035"], "zone")
  var watchCounties = geomFromAtlas(atlas, ["OHC035", "OHC093"], "zone") || cuyahogaCounty
  return [
    scene("tornado-warning", "Tornado Warning", [
      alert("Tornado Warning", "Extreme", "Immediate", "Observed",
        "TAKE COVER NOW. Move to a basement or an interior room on the lowest floor of a sturdy building. Avoid windows. If you are outdoors, in a mobile home, or in a vehicle, move to the closest substantial shelter and protect yourself from flying debris.",
        "Cleveland, OH", 0.5, wedge(), "polygon")
    ]),
    scene("tornado-watch", "Tornado Watch", [
      alert("Tornado Watch", "Moderate", "Expected", "Possible",
        "Be ready. A tornado watch means conditions are favorable. Have a way to receive warnings and know where you will take shelter. This watch covers a broad area; a warning means take cover now.",
        "Cuyahoga County, OH", 4, watchCounties, "zone")
    ]),
    scene("severe-thunderstorm-warning", "Severe Thunderstorm Warning", [
      alert("Severe Thunderstorm Warning", "Severe", "Immediate", "Observed",
        "For your protection move to an interior room on the lowest floor of a building. Avoid windows. Flying debris will be dangerous to those caught without shelter. Heavy rain may flood low-lying roads.",
        "Cleveland, OH", 0.6, stormTrack(), "polygon")
    ]),
    scene("severe-thunderstorm-watch", "Severe Thunderstorm Watch", [
      alert("Severe Thunderstorm Watch", "Moderate", "Expected", "Possible",
        "A severe thunderstorm watch means conditions are favorable for severe storms with damaging wind and large hail. Be prepared to move to shelter if a warning is issued.",
        "Cuyahoga County, OH", 5, watchCounties, "zone")
    ]),
    scene("flash-flood-warning", "Flash Flood Warning", [
      alert("Flash Flood Warning", "Severe", "Immediate", "Likely",
        "Turn around, don't drown when encountering flooded roads. Most flood deaths occur in vehicles. Move to higher ground now. Do not walk or drive through flood waters.",
        "West Branch of the Black River", 2, creek(), "polygon")
    ]),
    scene("flash-flood-watch", "Flash Flood Watch", [
      alert("Flash Flood Watch", "Severe", "Future", "Possible",
        "A flash flood watch is in effect. Be prepared to move to higher ground. Avoid low water crossings and stay informed as storms train over the same area.",
        "Cuyahoga County, OH", 8, cuyahogaCounty, "zone")
    ]),
    scene("flood-warning", "Flood Warning", [
      alert("Flood Warning", "Severe", "Expected", "Likely",
        "River flooding is occurring or imminent. Stay away from flood waters. Never drive through flooded roadways. The river is expected to remain above flood stage into the evening.",
        "Black River at Elyria", 18, cuyahogaCounty, "zone")
    ]),
    scene("flood-advisory", "Flood Advisory", [
      alert("Flood Advisory", "Minor", "Expected", "Likely",
        "Turn around, don't drown when encountering flooded roads. Most flood deaths occur in vehicles. Be aware of your surroundings and do not drive on flooded roads.",
        "Cleveland, OH", 2, ponding(), "polygon")
    ]),
    scene("winter-storm-warning", "Winter Storm Warning", [
      alert("Winter Storm Warning", "Severe", "Expected", "Likely",
        "Hazardous travel is expected from accumulating snow and blowing snow. If you must travel, keep an extra flashlight, food, and water in your vehicle. The latest road conditions can be obtained from local authorities.",
        "Cleveland, OH", 18, cuyahogaCounty, "zone")
    ]),
    scene("winter-storm-watch", "Winter Storm Watch", [
      alert("Winter Storm Watch", "Moderate", "Future", "Possible",
        "A winter storm watch means significant snow, sleet, or ice is possible. Plan to avoid travel and have extra supplies on hand if the watch is upgraded to a warning.",
        "Cuyahoga County, OH", 30, watchCounties, "zone")
    ]),
    scene("ice-storm-warning", "Ice Storm Warning", [
      alert("Ice Storm Warning", "Severe", "Expected", "Likely",
        "Power outages and tree damage are likely from ice accumulation. Stay off the roads. If you lose power, use generators outdoors only. Falling limbs will be a hazard.",
        "Cleveland, OH", 12, cuyahogaCounty, "zone")
    ]),
    scene("blizzard-warning", "Blizzard Warning", [
      alert("Blizzard Warning", "Severe", "Expected", "Likely",
        "Whiteout conditions and life-threatening travel are expected. Do not travel. If you are caught outside, seek sturdy shelter immediately. Blowing snow will reduce visibility to near zero.",
        "Cleveland, OH", 12, cuyahogaCounty, "zone")
    ]),
    scene("snow-squall-warning", "Snow Squall Warning", [
      alert("Snow Squall Warning", "Severe", "Immediate", "Observed",
        "A snow squall is moving through. Sudden whiteout and slick roads will make travel extremely dangerous. If driving, pull off the highway until the squall passes. Do not slam on the brakes.",
        "Cleveland, OH", 0.7, squall(), "polygon")
    ]),
    scene("wind-chill-warning", "Wind Chill Warning", [
      alert("Wind Chill Warning", "Severe", "Expected", "Likely",
        "Dangerously cold wind chills will cause frostbite in minutes on exposed skin. Limit time outdoors. Dress in layers and cover all exposed skin.",
        "Cleveland, OH", 14, cuyahogaCounty, "zone")
    ]),
    scene("freeze-warning", "Freeze Warning", [
      alert("Freeze Warning", "Moderate", "Expected", "Likely",
        "Sub-freezing temperatures will kill unprotected plants and may freeze pipes. Cover tender vegetation and allow faucets to drip if they are vulnerable.",
        "Cleveland, OH", 10, cuyahogaCounty, "zone")
    ]),
    scene("winter-weather-advisory", "Winter Weather Advisory", [
      alert("Winter Weather Advisory", "Minor", "Expected", "Likely",
        "Snow and ice will make roads slick. Slow down and allow extra time. Isolated power outages are possible where ice accretes on trees.",
        "Cleveland, OH", 8, cuyahogaCounty, "zone")
    ]),
    scene("heat-advisory", "Heat Advisory", [
      alert("Heat Advisory", "Moderate", "Expected", "Likely",
        "Drink plenty of fluids, stay in an air-conditioned room, stay out of the sun, and check on relatives and neighbors. Watch for heat exhaustion and heat stroke.",
        "Cleveland, OH", 10, cuyahogaCounty, "zone")
    ]),
    scene("special-weather-statement", "Special Weather Statement", [
      alert("Special Weather Statement", "Moderate", "Expected", "Observed",
        "Strong thunderstorms will pass through the area. Brief wind gusts, small hail, and heavy downpours are possible. This is not a warning.",
        "Cuyahoga County, OH", 1, cell(), "polygon")
    ]),
    scene("stack", "Warning + watch + advisory", [
      alert("Tornado Warning", "Extreme", "Immediate", "Observed",
        "TAKE COVER NOW. Move to a basement or an interior room on the lowest floor of a sturdy building. Avoid windows.",
        "Cleveland, OH", 0.4, wedge(), "polygon"),
      alert("Winter Storm Watch", "Moderate", "Future", "Possible",
        "Significant snow is possible behind the severe weather. Have extra supplies on hand.",
        "Cuyahoga County, OH", 24, watchCounties, "zone"),
      alert("Flood Advisory", "Minor", "Expected", "Likely",
        "Turn around, don't drown when encountering flooded roads.",
        "Cuyahoga County, OH", 3, ponding(), "polygon")
    ])
  ]
}

function scene(id, title, features) {
  return { id: id, title: title, features: features }
}

function alert(event, severity, urgency, certainty, instruction, area, hours, geometry, kind) {
  var onset = new Date()
  var expires = new Date(onset.getTime() + hours * 3600000)
  return {
    type: "Feature",
    geometry: geometry,
    properties: {
      id: "demo:" + event + ":" + area,
      event: event,
      severity: severity,
      urgency: urgency,
      certainty: certainty,
      headline: event + " issued for " + area,
      description: "DEMO product for layout testing. Not a National Weather Service issuance.",
      instruction: instruction,
      areaDesc: area,
      sent: onset.toISOString(),
      onset: onset.toISOString(),
      expires: expires.toISOString(),
      messageType: "Alert",
      status: "Actual",
      geometryKind: kind || (geometry ? "polygon" : ""),
      response: severity === "Extreme" || (severity === "Severe" && urgency === "Immediate") ? "Shelter" : "Monitor"
    }
  }
}

function geomFromAtlas(atlas, ids, kind) {
  if (!atlas || !ids || ids.length === 0) return null
  var polygons = []
  for (var i = 0; i < ids.length; i++) {
    var rings = atlas[ids[i]]
    if (!rings) continue
    var ring = rings[0] && typeof rings[0][0] === "number" ? rings : rings[0]
    if (ring && ring.length >= 3) polygons.push([ring])
  }
  if (polygons.length === 0) return null
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] }
  return { type: "MultiPolygon", coordinates: polygons }
}

function poly(offsets) {
  var ring = []
  for (var i = 0; i < offsets.length; i++) {
    ring.push([CLEVELAND.lon + offsets[i][0], CLEVELAND.lat + offsets[i][1]])
  }
  var first = ring[0]
  var last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  return { type: "Polygon", coordinates: [ring] }
}

function wedge() {
  return poly([
    [0.018, 0.055],
    [0.072, 0.018],
    [0.048, -0.038],
    [-0.012, -0.008]
  ])
}

function stormTrack() {
  return poly([
    [-0.12, 0.018],
    [-0.04, 0.072],
    [0.14, 0.038],
    [0.16, -0.028],
    [0.02, -0.068],
    [-0.10, -0.028]
  ])
}

function creek() {
  return poly([
    [-0.05, 0.012],
    [-0.01, 0.058],
    [0.04, 0.042],
    [0.09, 0.008],
    [0.06, -0.032],
    [0.01, -0.048],
    [-0.04, -0.022],
    [-0.07, 0.004]
  ])
}

function county() {
  return poly([
    [-0.18, 0.12],
    [0.16, 0.14],
    [0.20, -0.10],
    [-0.14, -0.12]
  ])
}

function ponding() {
  return poly([
    [-0.03, 0.02],
    [0.02, 0.035],
    [0.05, 0.008],
    [0.03, -0.028],
    [-0.02, -0.022]
  ])
}

function cell() {
  return poly([
    [0.00, 0.038],
    [0.046, 0.012],
    [0.028, -0.028],
    [-0.026, -0.018],
    [-0.018, 0.02]
  ])
}

function squall() {
  return poly([
    [-0.16, 0.03],
    [-0.08, 0.05],
    [0.12, 0.02],
    [0.18, -0.01],
    [0.10, -0.04],
    [-0.12, -0.02]
  ])
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    demoEnabled: demoEnabled,
    scenes: scenes
  }
}
