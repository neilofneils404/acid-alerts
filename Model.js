// Acid Alerts — NWS GeoJSON parsing, ranking, and footprint math.
// Qt-free so node can unit-test it. QML owns presentation.

var SEVERITY_RANK = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0
}

var URGENCY_RANK = {
  Immediate: 3,
  Expected: 2,
  Future: 1,
  Past: 0,
  Unknown: 0
}

var SHORT_EVENT = {
  "Tornado Warning": "TORNADO",
  "Tornado Watch": "TOR WATCH",
  "Severe Thunderstorm Warning": "SEVERE TSTM",
  "Severe Thunderstorm Watch": "SVR WATCH",
  "Flash Flood Warning": "FLASH FLOOD",
  "Flash Flood Watch": "FF WATCH",
  "Flash Flood Statement": "FLASH FLOOD",
  "Flood Warning": "FLOOD",
  "Flood Watch": "FLOOD WATCH",
  "Flood Advisory": "FLOOD",
  "Coastal Flood Warning": "COASTAL FLD",
  "Coastal Flood Watch": "COASTAL FLD",
  "Coastal Flood Advisory": "COASTAL FLD",
  "Storm Surge Warning": "SURGE",
  "Storm Surge Watch": "SURGE WATCH",
  "Hurricane Warning": "HURRICANE",
  "Hurricane Watch": "CANE WATCH",
  "Tropical Storm Warning": "TROP STORM",
  "Tropical Storm Watch": "TROP WATCH",
  "Extreme Wind Warning": "EXT WIND",
  "High Wind Warning": "HIGH WIND",
  "High Wind Watch": "WIND WATCH",
  "Wind Advisory": "WIND",
  "Lake Wind Advisory": "LAKE WIND",
  "Dust Storm Warning": "DUST STORM",
  "Blowing Dust Advisory": "DUST",
  "Dense Fog Advisory": "FOG",
  "Dense Smoke Advisory": "SMOKE",
  "Fire Weather Watch": "FIRE WATCH",
  "Avalanche Warning": "AVALANCHE",
  "Avalanche Watch": "AVALANCHE",
  "Special Weather Statement": "SPS",
  "Hydrologic Outlook": "HYDRO",
  "Flood Statement": "FLOOD",
  "Blizzard Warning": "BLIZZARD",
  "Blizzard Watch": "BLIZ WATCH",
  "Winter Storm Warning": "WINTER",
  "Winter Storm Watch": "WINTER WATCH",
  "Winter Weather Advisory": "WINTER",
  "Ice Storm Warning": "ICE STORM",
  "Lake Effect Snow Warning": "LE SNOW",
  "Lake Effect Snow Advisory": "LE SNOW",
  "Snow Squall Warning": "SNOW SQUALL",
  "Freezing Rain Advisory": "FZ RAIN",
  "Freezing Fog Advisory": "FRZ FOG",
  "Wind Chill Warning": "WIND CHILL",
  "Wind Chill Watch": "WIND CHILL",
  "Wind Chill Advisory": "WIND CHILL",
  "Extreme Cold Warning": "EXT COLD",
  "Extreme Cold Watch": "EXT COLD",
  "Freeze Warning": "FREEZE",
  "Hard Freeze Warning": "HARD FRZ",
  "Frost Advisory": "FROST",
  "Excessive Heat Warning": "HEAT",
  "Excessive Heat Watch": "HEAT WATCH",
  "Extreme Heat Warning": "HEAT",
  "Heat Advisory": "HEAT",
  "Red Flag Warning": "RED FLAG",
  "Special Marine Warning": "MARINE",
  "Gale Warning": "GALE",
  "Tsunami Warning": "TSUNAMI",
  "Air Quality Alert": "AIR QUALITY"
}

var EVENT_ICON = {
  "Tornado Warning": "",
  "Tornado Watch": "",
  "Severe Thunderstorm Warning": "",
  "Severe Thunderstorm Watch": "",
  "Flash Flood Warning": "",
  "Flash Flood Watch": "",
  "Flash Flood Statement": "",
  "Flood Warning": "",
  "Flood Watch": "",
  "Flood Advisory": "",
  "Coastal Flood Warning": "",
  "Coastal Flood Watch": "",
  "Coastal Flood Advisory": "",
  "Storm Surge Warning": "",
  "Storm Surge Watch": "",
  "Hurricane Warning": "",
  "Hurricane Watch": "",
  "Tropical Storm Warning": "",
  "Tropical Storm Watch": "",
  "Extreme Wind Warning": "",
  "High Wind Warning": "",
  "High Wind Watch": "",
  "Wind Advisory": "",
  "Lake Wind Advisory": "",
  "Dust Storm Warning": "",
  "Blowing Dust Advisory": "",
  "Dense Fog Advisory": "",
  "Dense Smoke Advisory": "",
  "Fire Weather Watch": "",
  "Avalanche Warning": "",
  "Avalanche Watch": "",
  "Hydrologic Outlook": "",
  "Flood Statement": "",
  "Blizzard Warning": "",
  "Blizzard Watch": "",
  "Winter Storm Warning": "",
  "Winter Storm Watch": "",
  "Winter Weather Advisory": "",
  "Ice Storm Warning": "",
  "Lake Effect Snow Warning": "",
  "Lake Effect Snow Advisory": "",
  "Snow Squall Warning": "",
  "Freezing Rain Advisory": "",
  "Freezing Fog Advisory": "",
  "Wind Chill Warning": "",
  "Wind Chill Watch": "",
  "Wind Chill Advisory": "",
  "Extreme Cold Warning": "",
  "Extreme Cold Watch": "",
  "Freeze Warning": "",
  "Hard Freeze Warning": "",
  "Frost Advisory": "",
  "Excessive Heat Warning": "",
  "Excessive Heat Watch": "",
  "Extreme Heat Warning": "",
  "Heat Advisory": "",
  "Red Flag Warning": "",
  "Special Marine Warning": "",
  "Gale Warning": "",
  "Tsunami Warning": "",
  "Special Weather Statement": "",
  "Air Quality Alert": ""
}

function parseLocation(raw, settings) {
  var unset = { name: "", latitude: null, longitude: null, source: "none" }
  var fromSettings = locationFromSettings(settings)
  if (fromSettings.latitude !== null) return fromSettings

  var text = String(raw || "")
  if (text === "") return unset
  try {
    var data = JSON.parse(text)
    if (!data || typeof data !== "object") return unset
    var latitude = Number(data.latitude)
    var longitude = Number(data.longitude)
    var hasCoordinates = isFinite(latitude) && isFinite(longitude)
      && latitude >= -90 && latitude <= 90
      && longitude >= -180 && longitude <= 180
    var name = typeof data.name === "string" ? data.name.replace(/^\s+|\s+$/g, "") : ""
    return {
      name: name,
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      source: "weather"
    }
  } catch (e) {
    return unset
  }
}

function locationFromSettings(settings) {
  var unset = { name: "", latitude: null, longitude: null, source: "none" }
  if (!settings || typeof settings !== "object") return unset
  var latitude = Number(settings.latitude)
  var longitude = Number(settings.longitude)
  if (!isFinite(latitude) || !isFinite(longitude)) return unset
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return unset
  var name = typeof settings.name === "string" ? settings.name.replace(/^\s+|\s+$/g, "") : ""
  return {
    name: name,
    latitude: latitude,
    longitude: longitude,
    source: "settings"
  }
}

function hasCoordinates(location) {
  return !!(location && isFinite(Number(location.latitude)) && isFinite(Number(location.longitude)))
}

function alertsUrl(location) {
  if (!hasCoordinates(location)) return ""
  return "https://api.weather.gov/alerts/active?point="
    + encodeURIComponent(String(location.latitude)) + ","
    + encodeURIComponent(String(location.longitude))
}

function parseCollection(raw) {
  var empty = { alerts: [], error: "" }
  var text = String(raw || "")
  if (text === "") return empty
  try {
    var data = JSON.parse(text)
    if (!data || typeof data !== "object") return { alerts: [], error: "unreadable NWS payload" }
    if (data.type && data.type !== "FeatureCollection" && !data.features) {
      return { alerts: [], error: String(data.detail || data.title || "unexpected NWS payload") }
    }
    var features = data.features
    if (!features || !features.length) return empty
    var alerts = []
    for (var i = 0; i < features.length; i++) {
      var alert = normalizeAlert(features[i])
      if (alert) alerts.push(alert)
    }
    alerts.sort(compareAlerts)
    return { alerts: alerts, error: "" }
  } catch (e) {
    return { alerts: [], error: "unreadable NWS payload" }
  }
}

function normalizeAlert(feature) {
  if (!feature || typeof feature !== "object") return null
  var properties = feature.properties || {}
  var event = String(properties.event || "").replace(/^\s+|\s+$/g, "")
  if (event === "") return null
  var severity = knownOrUnknown(properties.severity, SEVERITY_RANK)
  var urgency = knownOrUnknown(properties.urgency, URGENCY_RANK)
  var certainty = String(properties.certainty || "Unknown")
  var id = String(properties.id || feature.id || "")
  if (id === "") id = event + "|" + String(properties.sent || "") + "|" + String(properties.areaDesc || "")
  var rings = extractRings(feature.geometry)
  var kind = String(properties.geometryKind || "")
  if (kind === "" && rings.length > 0) kind = "polygon"
  return {
    id: id,
    event: event,
    shortEvent: shortEvent(event),
    icon: eventIcon(event),
    severity: severity,
    urgency: urgency,
    certainty: certainty,
    rank: severityRank(severity),
    urgencyRank: urgencyRank(urgency),
    headline: String(properties.headline || event),
    description: String(properties.description || ""),
    instruction: String(properties.instruction || "").replace(/^\s+|\s+$/g, ""),
    area: String(properties.areaDesc || ""),
    sent: String(properties.sent || ""),
    onset: String(properties.onset || properties.effective || properties.sent || ""),
    expires: String(properties.expires || properties.ends || ""),
    response: String(properties.response || ""),
    messageType: String(properties.messageType || ""),
    rings: rings,
    zoneUrls: extractZoneUrls(properties),
    geometryKind: kind
  }
}

function eventIcon(event) {
  if (EVENT_ICON[event]) return EVENT_ICON[event]
  var text = String(event || "").toLowerCase()
  if (text.indexOf("tornado") !== -1) return ""
  if (text.indexOf("hurricane") !== -1 || text.indexOf("tropical") !== -1) return ""
  if (text.indexOf("thunder") !== -1) return ""
  if (text.indexOf("blizzard") !== -1) return ""
  if (text.indexOf("ice") !== -1 || text.indexOf("freezing rain") !== -1) return ""
  if (text.indexOf("snow") !== -1 || text.indexOf("winter") !== -1) return ""
  if (text.indexOf("flood") !== -1) return ""
  if (text.indexOf("heat") !== -1) return ""
  if (text.indexOf("wind") !== -1) return ""
  if (text.indexOf("dust") !== -1) return ""
  if (text.indexOf("avalanche") !== -1) return ""
  if (text.indexOf("cold") !== -1 || text.indexOf("chill") !== -1 || text.indexOf("freeze") !== -1 || text.indexOf("frost") !== -1) return ""
  if (text.indexOf("fire") !== -1 || text.indexOf("red flag") !== -1) return ""
  if (text.indexOf("marine") !== -1 || text.indexOf("gale") !== -1 || text.indexOf("lake wind") !== -1) return ""
  if (text.indexOf("fog") !== -1 || text.indexOf("smoke") !== -1) return ""
  return "󰀦"
}

function extractZoneUrls(properties) {
  var urls = []
  var seen = {}
  function add(url) {
    var value = String(url || "")
    if (value.indexOf("https://api.weather.gov/zones/") !== 0) return
    if (seen[value]) return
    seen[value] = true
    if (urls.length < 24) urls.push(value)
  }
  var zones = properties && properties.affectedZones
  if (zones && zones.length) {
    for (var i = 0; i < zones.length; i++) add(zones[i])
    return urls
  }
  var ugc = properties && properties.geocode && properties.geocode.UGC
  if (!ugc || !ugc.length) return urls
  for (var j = 0; j < ugc.length; j++) {
    var code = String(ugc[j] || "")
    var kind = code.charAt(2)
    var path = kind === "C" ? "county" : kind === "Z" ? "forecast" : kind === "A" ? "forecast" : kind === "F" ? "fire" : kind === "M" ? "marine" : ""
    if (path === "") continue
    add("https://api.weather.gov/zones/" + path + "/" + code)
  }
  return urls
}

function footprintCaption(kind) {
  if (kind === "polygon") return "NWS storm-based polygon"
  if (kind === "zone") return "NWS county / zone outline"
  return "No footprint in this product"
}

function knownOrUnknown(value, table) {
  var key = String(value || "")
  return table.hasOwnProperty(key) ? key : "Unknown"
}

function severityRank(severity) {
  return SEVERITY_RANK.hasOwnProperty(severity) ? SEVERITY_RANK[severity] : 0
}

function urgencyRank(urgency) {
  return URGENCY_RANK.hasOwnProperty(urgency) ? URGENCY_RANK[urgency] : 0
}

function shortEvent(event) {
  if (SHORT_EVENT[event]) return SHORT_EVENT[event]
  var text = String(event || "")
  text = text.replace(/\s+(Warning|Watch|Advisory|Statement)$/i, "")
  text = text.replace(/^\s+|\s+$/g, "")
  if (text.length > 14) text = text.slice(0, 13)
  return text === "" ? "ALERT" : text.toUpperCase()
}

function compareAlerts(a, b) {
  if (b.rank !== a.rank) return b.rank - a.rank
  if (b.urgencyRank !== a.urgencyRank) return b.urgencyRank - a.urgencyRank
  if (a.expires && b.expires && a.expires !== b.expires) return a.expires < b.expires ? -1 : 1
  if (a.event !== b.event) return a.event < b.event ? -1 : 1
  return a.id < b.id ? -1 : 1
}

function barLabel(alerts, vertical) {
  if (!alerts || alerts.length === 0) return ""
  var top = alerts[0]
  if (vertical) return alerts.length > 1 ? String(alerts.length) : top.shortEvent
  if (alerts.length === 1) return top.shortEvent
  return String(alerts.length) + " · " + top.shortEvent
}

function isWarningRank(rank) {
  return Number(rank) >= 3
}

function eventClass(event) {
  var name = String(event || "")
  if (/Warning$/i.test(name)) return "warning"
  if (/Watch$/i.test(name)) return "watch"
  return "advisory"
}

function familyOf(event) {
  var text = String(event || "").toLowerCase()
  if (text.indexOf("tornado") !== -1) return "tornado"
  if (text.indexOf("thunder") !== -1) return "thunderstorm"
  if (text.indexOf("flash flood") !== -1) return "flashflood"
  if (text.indexOf("flood") !== -1 || text.indexOf("surge") !== -1) return "flood"
  if (text.indexOf("winter") !== -1 || text.indexOf("ice") !== -1 || text.indexOf("blizzard") !== -1 || text.indexOf("snow") !== -1 || text.indexOf("freezing") !== -1) return "winter"
  if (text.indexOf("heat") !== -1) return "heat"
  if (text.indexOf("cold") !== -1 || text.indexOf("chill") !== -1 || text.indexOf("freeze") !== -1 || text.indexOf("frost") !== -1) return "cold"
  if (text.indexOf("fire") !== -1 || text.indexOf("red flag") !== -1) return "fire"
  if (text.indexOf("hurricane") !== -1 || text.indexOf("tropical") !== -1 || text.indexOf("tsunami") !== -1) return "tropical"
  if (text.indexOf("wind") !== -1 || text.indexOf("dust") !== -1) return "wind"
  if (text.indexOf("fog") !== -1 || text.indexOf("smoke") !== -1) return "fog"
  return "other"
}

function familyOptions() {
  return [
    { id: "tornado", label: "Tornado" },
    { id: "thunderstorm", label: "Severe tstorm" },
    { id: "flashflood", label: "Flash flood" },
    { id: "flood", label: "Flood" },
    { id: "winter", label: "Winter / ice" },
    { id: "wind", label: "Wind" },
    { id: "cold", label: "Cold / freeze" },
    { id: "heat", label: "Heat" },
    { id: "fire", label: "Fire" },
    { id: "tropical", label: "Tropical" },
    { id: "fog", label: "Fog / smoke" },
    { id: "other", label: "Other" }
  ]
}

function parseBoolSetting(value, fallback) {
  if (value === undefined || value === null) return fallback
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  var text = String(value).replace(/^\s+|\s+$/g, "").toLowerCase()
  if (text === "true" || text === "1" || text === "yes") return true
  if (text === "false" || text === "0" || text === "no") return false
  return fallback
}

function parseFilter(settings) {
  var data = settings && typeof settings === "object" ? settings : {}
  var families = []
  var raw = data.families
  if (raw && raw.length) {
    for (var i = 0; i < raw.length; i++) {
      var id = String(raw[i] || "")
      if (id !== "" && families.indexOf(id) === -1) families.push(id)
    }
  }
  return {
    warnings: parseBoolSetting(data.showWarnings, true),
    watches: parseBoolSetting(data.showWatches, false),
    advisories: parseBoolSetting(data.showAdvisories, false),
    families: families
  }
}

function matchesFilter(alert, filter) {
  if (!alert) return false
  var rules = filter || parseFilter({})
  var cls = eventClass(alert.event)
  if (cls === "warning" && !rules.warnings) return false
  if (cls === "watch" && !rules.watches) return false
  if (cls === "advisory" && !rules.advisories) return false
  if (rules.families && rules.families.length > 0) {
    if (rules.families.indexOf(familyOf(alert.event)) === -1) return false
  }
  return true
}

function filterAlerts(alerts, filter) {
  var out = []
  if (!alerts) return out
  for (var i = 0; i < alerts.length; i++) {
    if (matchesFilter(alerts[i], filter)) out.push(alerts[i])
  }
  return out
}

function shouldNotify(alert, seen, firstLoad) {
  if (!alert || !alert.id) return false
  if (seen && seen[alert.id]) return false
  if (alert.rank >= 3) return true
  if (firstLoad) return false
  if (alert.rank >= 2 && alert.urgencyRank >= 3) return true
  return false
}

function mergeSeen(seen, alerts, nowMs, maxAgeMs) {
  var next = {}
  var age = isFinite(Number(maxAgeMs)) ? Number(maxAgeMs) : 172800000
  var now = Number(nowMs)
  if (seen && typeof seen === "object") {
    for (var key in seen) {
      var stamp = Number(seen[key])
      if (isFinite(stamp) && isFinite(now) && (now - stamp) <= age) next[key] = stamp
    }
  }
  if (alerts) {
    for (var i = 0; i < alerts.length; i++) {
      var id = alerts[i] && alerts[i].id
      if (!id) continue
      next[id] = isFinite(now) ? now : Date.now()
    }
  }
  return next
}

function parseSeen(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    if (!data || typeof data !== "object") return {}
    var seen = data.seen
    if (!seen || typeof seen !== "object" || Array.isArray(seen)) return {}
    var out = {}
    for (var key in seen) {
      var stamp = Number(seen[key])
      if (isFinite(stamp)) out[key] = stamp
    }
    return out
  } catch (e) {
    return {}
  }
}

function serializeSeen(seen) {
  return JSON.stringify({ seen: seen && typeof seen === "object" ? seen : {} })
}

function extractRings(geometry) {
  if (!geometry || typeof geometry !== "object") return []
  var type = String(geometry.type || "")
  var coordinates = geometry.coordinates
  if (!coordinates) return []
  if (type === "Polygon") return polygonRings(coordinates)
  if (type === "MultiPolygon") {
    var rings = []
    for (var i = 0; i < coordinates.length; i++) {
      var part = polygonRings(coordinates[i])
      for (var j = 0; j < part.length; j++) rings.push(part[j])
    }
    return rings
  }
  return []
}

function polygonRings(coordinates) {
  if (!coordinates || !coordinates.length) return []
  var rings = []
  for (var i = 0; i < coordinates.length; i++) {
    var ring = numericRing(coordinates[i])
    if (ring.length >= 3) rings.push(ring)
  }
  return rings
}

function numericRing(points) {
  var ring = []
  if (!points || !points.length) return ring
  for (var i = 0; i < points.length; i++) {
    var point = points[i]
    if (!point || point.length < 2) continue
    var lon = Number(point[0])
    var lat = Number(point[1])
    if (!isFinite(lon) || !isFinite(lat)) continue
    ring.push([lon, lat])
  }
  return ring
}

function boundsFor(rings, userLat, userLon, pad) {
  var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  var found = false
  function include(lon, lat) {
    if (!isFinite(lon) || !isFinite(lat)) return
    found = true
    if (lon < minLon) minLon = lon
    if (lat < minLat) minLat = lat
    if (lon > maxLon) maxLon = lon
    if (lat > maxLat) maxLat = lat
  }
  if (rings) {
    for (var i = 0; i < rings.length; i++) {
      var ring = rings[i]
      for (var j = 0; j < ring.length; j++) include(ring[j][0], ring[j][1])
    }
  }
  include(Number(userLon), Number(userLat))
  if (!found) return null
  if (minLon === maxLon) {
    minLon -= 0.15
    maxLon += 0.15
  }
  if (minLat === maxLat) {
    minLat -= 0.15
    maxLat += 0.15
  }
  var fraction = isFinite(Number(pad)) ? Number(pad) : 0.18
  var dLon = (maxLon - minLon) * fraction
  var dLat = (maxLat - minLat) * fraction
  return {
    minLon: minLon - dLon,
    minLat: minLat - dLat,
    maxLon: maxLon + dLon,
    maxLat: maxLat + dLat
  }
}

function project(lon, lat, bounds, width, height) {
  if (!bounds) return null
  var xSpan = bounds.maxLon - bounds.minLon
  var ySpan = bounds.maxLat - bounds.minLat
  if (xSpan === 0 || ySpan === 0) return null
  var x = ((Number(lon) - bounds.minLon) / xSpan) * width
  var y = ((bounds.maxLat - Number(lat)) / ySpan) * height
  if (!isFinite(x) || !isFinite(y)) return null
  return { x: x, y: y }
}

function pointInRing(lon, lat, ring) {
  if (!ring || ring.length < 3) return false
  var inside = false
  var j = ring.length - 1
  for (var i = 0; i < ring.length; i++) {
    var xi = ring[i][0], yi = ring[i][1]
    var xj = ring[j][0], yj = ring[j][1]
    var intersect = ((yi > lat) !== (yj > lat))
      && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)
    if (intersect) inside = !inside
    j = i
  }
  return inside
}

function pointInRings(lon, lat, rings) {
  if (!rings || rings.length === 0) return false
  if (!pointInRing(lon, lat, rings[0])) return false
  for (var i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false
  }
  return true
}

function rasterCells(rings, bounds, columns, rows) {
  var cells = []
  if (!bounds || columns < 1 || rows < 1) return cells
  var xSpan = bounds.maxLon - bounds.minLon
  var ySpan = bounds.maxLat - bounds.minLat
  for (var row = 0; row < rows; row++) {
    var lat = bounds.maxLat - ((row + 0.5) / rows) * ySpan
    for (var col = 0; col < columns; col++) {
      var lon = bounds.minLon + ((col + 0.5) / columns) * xSpan
      if (pointInRings(lon, lat, rings)) cells.push(row * columns + col)
    }
  }
  return cells
}

function mapLayers(alerts, selectedId) {
  var layers = []
  if (!alerts) return layers
  for (var i = 0; i < alerts.length; i++) {
    var alert = alerts[i]
    if (!alert || !alert.rings || alert.rings.length === 0) continue
    layers.push({
      id: alert.id,
      rings: alert.rings,
      rank: alert.rank,
      kind: alert.geometryKind || "",
      selected: alert.id === selectedId
    })
  }
  return layers
}

function simplifyRing(ring, maxPoints) {
  if (!ring || ring.length <= maxPoints) return ring || []
  var cap = Math.max(8, Number(maxPoints) || 80)
  var step = Math.max(1, Math.ceil((ring.length - 1) / (cap - 1)))
  var out = []
  for (var i = 0; i < ring.length - 1; i += step) out.push(ring[i])
  var last = ring[ring.length - 1]
  var first = out[0]
  if (!last || !first) return ring
  if (out[out.length - 1][0] !== last[0] || out[out.length - 1][1] !== last[1]) out.push(last)
  if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) out.push([out[0][0], out[0][1]])
  return out
}

function parseZoneDocument(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    var rings = extractRings(data.geometry)
    var out = []
    for (var i = 0; i < rings.length; i++) out.push(simplifyRing(rings[i], 80))
    return out
  } catch (e) {
    return []
  }
}

function parseZoneAtlas(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    var source = data && data.rings ? data.rings : data
    if (!source || typeof source !== "object") return {}
    var out = {}
    for (var key in source) {
      var value = source[key]
      if (!value) continue
      if (value.length && value[0] && typeof value[0][0] === "number") out[key] = [value]
      else if (value.length && value[0] && value[0][0] && typeof value[0][0][0] === "number") out[key] = value
    }
    return out
  } catch (e) {
    return {}
  }
}

function attachZoneRings(alerts, cache) {
  if (!alerts) return alerts || []
  for (var i = 0; i < alerts.length; i++) {
    var alert = alerts[i]
    if (!alert) continue
    if (alert.rings && alert.rings.length > 0) continue
    var urls = alert.zoneUrls || []
    var rings = []
    for (var j = 0; j < urls.length; j++) {
      var got = cache && cache[urls[j]]
      if (!got) continue
      for (var k = 0; k < got.length; k++) rings.push(got[k])
    }
    if (rings.length > 0) {
      alert.rings = rings
      alert.geometryKind = "zone"
    }
  }
  return alerts
}

function missingZoneUrls(alerts, cache) {
  var urls = []
  var seen = {}
  if (!alerts) return urls
  for (var i = 0; i < alerts.length; i++) {
    var alert = alerts[i]
    if (!alert || (alert.rings && alert.rings.length > 0)) continue
    var list = alert.zoneUrls || []
    for (var j = 0; j < list.length; j++) {
      var url = list[j]
      if (!url || seen[url] || (cache && cache[url])) continue
      seen[url] = true
      urls.push(url)
    }
  }
  return urls
}

function edgeCells(rings, bounds, columns, rows) {
  var cells = []
  var seen = {}
  if (!bounds || columns < 1 || rows < 1 || !rings) return cells
  function add(col, row) {
    if (col < 0 || row < 0 || col >= columns || row >= rows) return
    var key = row * columns + col
    if (seen[key]) return
    seen[key] = true
    cells.push(key)
  }
  for (var i = 0; i < rings.length; i++) {
    var ring = rings[i]
    if (!ring || ring.length < 2) continue
    var points = []
    for (var j = 0; j < ring.length; j++) {
      var projected = project(ring[j][0], ring[j][1], bounds, columns, rows)
      if (projected) points.push(projected)
    }
    for (var p = 0; p < points.length; p++) {
      var a = points[p]
      var b = points[(p + 1) % points.length]
      var dx = b.x - a.x
      var dy = b.y - a.y
      var steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
      for (var s = 0; s <= steps; s++) {
        add(Math.floor(a.x + dx * (s / steps)), Math.floor(a.y + dy * (s / steps)))
      }
    }
  }
  return cells
}

function userAgent() {
  return "(AcidAlerts, https://github.com/neilofneils404/acid-alerts)"
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseLocation: parseLocation,
    locationFromSettings: locationFromSettings,
    hasCoordinates: hasCoordinates,
    alertsUrl: alertsUrl,
    parseCollection: parseCollection,
    normalizeAlert: normalizeAlert,
    shortEvent: shortEvent,
    compareAlerts: compareAlerts,
    barLabel: barLabel,
    isWarningRank: isWarningRank,
    eventClass: eventClass,
    familyOf: familyOf,
    familyOptions: familyOptions,
    parseBoolSetting: parseBoolSetting,
    parseFilter: parseFilter,
    matchesFilter: matchesFilter,
    filterAlerts: filterAlerts,
    shouldNotify: shouldNotify,
    mergeSeen: mergeSeen,
    parseSeen: parseSeen,
    serializeSeen: serializeSeen,
    extractRings: extractRings,
    boundsFor: boundsFor,
    project: project,
    pointInRings: pointInRings,
    rasterCells: rasterCells,
    mapLayers: mapLayers,
    userAgent: userAgent,
    severityRank: severityRank,
    eventIcon: eventIcon,
    extractZoneUrls: extractZoneUrls,
    footprintCaption: footprintCaption,
    parseZoneDocument: parseZoneDocument,
    parseZoneAtlas: parseZoneAtlas,
    attachZoneRings: attachZoneRings,
    missingZoneUrls: missingZoneUrls,
    edgeCells: edgeCells,
    simplifyRing: simplifyRing
  }
}
