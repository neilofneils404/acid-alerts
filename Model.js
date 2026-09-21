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
  "Flood Advisory": "FLOOD ADV",
  "Coastal Flood Warning": "COASTAL FLD",
  "Coastal Flood Watch": "CSTL WATCH",
  "Coastal Flood Advisory": "CSTL ADV",
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
  "Winter Weather Advisory": "WINTER ADV",
  "Ice Storm Warning": "ICE STORM",
  "Lake Effect Snow Warning": "LE SNOW",
  "Lake Effect Snow Advisory": "SNOW ADV",
  "Snow Squall Warning": "SNOW SQUALL",
  "Freezing Rain Advisory": "FZ RAIN",
  "Freezing Fog Advisory": "FRZ FOG",
  "Wind Chill Warning": "WIND CHILL",
  "Wind Chill Watch": "CHILL WATCH",
  "Wind Chill Advisory": "CHILL ADV",
  "Extreme Cold Warning": "EXT COLD",
  "Extreme Cold Watch": "COLD WATCH",
  "Freeze Warning": "FREEZE",
  "Hard Freeze Warning": "HARD FRZ",
  "Frost Advisory": "FROST",
  "Excessive Heat Warning": "HEAT",
  "Excessive Heat Watch": "HEAT WATCH",
  "Extreme Heat Warning": "HEAT",
  "Heat Advisory": "HEAT ADV",
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

// curl >= 8.4.0 enforces this even without Content-Length. Keep the parser
// guard in bytes too, without allocating another encoded copy of the body.
function responseByteLimit() { return 1024 * 1024 }

function responseTooLarge(text) {
  var limit = responseByteLimit()
  if (text.length > limit) return true
  var bytes = 0
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length
             && text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
      bytes += 4
      i++
    } else bytes += 3
    if (bytes > limit) return true
  }
  return false
}

function parseCollection(raw) {
  var empty = { alerts: [], error: "" }
  var text = String(raw || "")
  if (responseTooLarge(text)) return { alerts: [], error: "NWS response exceeds size limit" }
  if (text.trim() === "") return { alerts: [], error: "empty NWS response" }
  try {
    var data = JSON.parse(text)
    if (!data || typeof data !== "object") return { alerts: [], error: "unreadable NWS payload" }
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      return { alerts: [], error: String(data.detail || data.title || "unexpected NWS payload") }
    }
    var features = data.features
    if (!features || !features.length) return empty
    var alerts = []
    for (var i = 0; i < features.length; i++) {
      var alert = normalizeAlert(features[i])
      if (!alert) return { alerts: [], error: "unreadable NWS alert" }
      if (alert.skip) continue
      alerts.push(alert)
    }
    alerts.sort(compareAlerts)
    return { alerts: alerts, error: "" }
  } catch (e) {
    return { alerts: [], error: "unreadable NWS payload" }
  }
}

// Follow-ups that replace a warning in the active feed. They are not advisories.
var WARNING_FOLLOWUPS = {
  "Flash Flood Statement": true,
  "Flood Statement": true,
  "Severe Weather Statement": true
}

function skippedProduct(properties) {
  var status = String(properties.status || "")
  if (status !== "" && status !== "Actual") return true
  var messageType = String(properties.messageType || "")
  return messageType === "Cancel"
}

function normalizeAlert(feature) {
  if (!feature || typeof feature !== "object") return null
  var properties = feature.properties || {}
  var event = String(properties.event || "").replace(/^\s+|\s+$/g, "")
  if (event === "") return null
  if (skippedProduct(properties)) return { skip: true }
  var severity = knownOrUnknown(properties.severity, SEVERITY_RANK)
  var urgency = knownOrUnknown(properties.urgency, URGENCY_RANK)
  var certainty = String(properties.certainty || "Unknown")
  var id = String(properties.id || feature.id || "")
  if (id === "") id = event + "|" + String(properties.sent || "") + "|" + String(properties.areaDesc || "")
  var polygons = extractPolygons(feature.geometry)
  var rings = flattenPolygons(polygons)
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
    expires: String(properties.expires || ""),
    ends: String(properties.ends || ""),
    response: String(properties.response || ""),
    messageType: String(properties.messageType || ""),
    sender: String(properties.senderName || "").replace(/^\s+|\s+$/g, ""),
    category: String(properties.category || ""),
    rings: rings,
    polygons: polygons,
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

// The bar treats the highest-ranked alert as current. A warning stays urgent
// even when NWS ranks it Moderate, so a flood or freeze warning is not quiet.
function leadUrgent(alert) {
  if (!alert) return false
  return eventClass(alert.event) === "warning" || isWarningRank(alert.rank)
}

function eventClass(event) {
  var name = String(event || "")
  if (WARNING_FOLLOWUPS[name]) return "warning"
  if (/Warning$/i.test(name)) return "warning"
  if (/Watch$/i.test(name)) return "watch"
  return "advisory"
}

function familyOf(event) {
  var text = String(event || "").toLowerCase()
  if (text.indexOf("tornado") !== -1) return "tornado"
  if (text.indexOf("thunder") !== -1 || text.indexOf("severe weather statement") !== -1) return "thunderstorm"
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
  // The first check only interrupts for a warning that needs action now.
  // Expected/Future urgency does not interrupt on startup.
  if (firstLoad) return eventClass(alert.event) === "warning" && alert.rank >= 3 && alert.urgencyRank >= 3
  if (alert.rank >= 3) return true
  if (alert.rank >= 2 && alert.urgencyRank >= 3) return true
  return false
}

function unexpired(alerts, nowMs) {
  var out = []
  var now = Number(nowMs)
  if (!alerts) return out
  for (var i = 0; i < alerts.length; i++) {
    var alert = alerts[i]
    if (!alert) continue
    var stamp = Date.parse(alert.expires || "")
    if (isFinite(stamp) && isFinite(now) && stamp <= now) continue
    out.push(alert)
  }
  return out
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

// A polygon is an outer ring plus any holes. A MultiPolygon is several of
// those, and each county or zone outline is its own polygon. Flattening them
// into one ring list makes later shapes count as holes.
function extractPolygons(geometry) {
  if (!geometry || typeof geometry !== "object") return []
  var type = String(geometry.type || "")
  var coordinates = geometry.coordinates
  if (!coordinates) return []
  if (type === "Polygon") {
    var rings = polygonRings(coordinates)
    return rings.length > 0 ? [rings] : []
  }
  if (type === "MultiPolygon") {
    var polygons = []
    for (var i = 0; i < coordinates.length; i++) {
      var part = polygonRings(coordinates[i])
      if (part.length > 0) polygons.push(part)
    }
    return polygons
  }
  return []
}

function flattenPolygons(polygons) {
  var rings = []
  if (!polygons) return rings
  for (var i = 0; i < polygons.length; i++) {
    var polygon = polygons[i] || []
    for (var j = 0; j < polygon.length; j++) rings.push(polygon[j])
  }
  return rings
}

function extractRings(geometry) {
  return flattenPolygons(extractPolygons(geometry))
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

function latitudeScale(lat) {
  var cosine = Math.cos(Number(lat) * Math.PI / 180)
  if (!isFinite(cosine) || cosine < 0.2) return 0.2
  return cosine
}

// Fit the geographic box into the pixel grid at one ground scale, so a
// degree of longitude is shorter than a degree of latitude away from the equator.
function frameFor(bounds, width, height) {
  if (!bounds || width < 1 || height < 1) return null
  var midLat = (bounds.minLat + bounds.maxLat) / 2
  var scale = latitudeScale(midLat)
  var x0 = bounds.minLon * scale
  var y1 = bounds.maxLat
  var worldW = (bounds.maxLon - bounds.minLon) * scale
  var worldH = bounds.maxLat - bounds.minLat
  if (!(worldW > 0) || !(worldH > 0)) return null
  var pixel = Math.min(width / worldW, height / worldH)
  return {
    scale: scale,
    x0: x0,
    y1: y1,
    pixel: pixel,
    ox: (width - worldW * pixel) / 2,
    oy: (height - worldH * pixel) / 2
  }
}

function project(lon, lat, bounds, width, height) {
  var frame = frameFor(bounds, width, height)
  if (!frame) return null
  var x = frame.ox + (Number(lon) * frame.scale - frame.x0) * frame.pixel
  var y = frame.oy + (frame.y1 - Number(lat)) * frame.pixel
  if (!isFinite(x) || !isFinite(y)) return null
  return { x: x, y: y }
}

function unproject(x, y, bounds, width, height) {
  var frame = frameFor(bounds, width, height)
  if (!frame || !(frame.pixel > 0)) return null
  var lon = (frame.x0 + (Number(x) - frame.ox) / frame.pixel) / frame.scale
  var lat = frame.y1 - (Number(y) - frame.oy) / frame.pixel
  if (!isFinite(lon) || !isFinite(lat)) return null
  return { lon: lon, lat: lat }
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

function pointInPolygons(lon, lat, polygons) {
  if (!polygons) return false
  for (var i = 0; i < polygons.length; i++) {
    var polygon = polygons[i]
    if (!polygon || polygon.length === 0) continue
    if (!pointInRing(lon, lat, polygon[0])) continue
    var insideHole = false
    for (var hole = 1; hole < polygon.length; hole++) {
      if (pointInRing(lon, lat, polygon[hole])) {
        insideHole = true
        break
      }
    }
    if (!insideHole) return true
  }
  return false
}

// One polygon: the first ring is the outline and the rest are holes.
function pointInRings(lon, lat, rings) {
  if (!rings || rings.length === 0) return false
  return pointInPolygons(lon, lat, [rings])
}

function rasterCells(polygons, bounds, columns, rows) {
  var cells = []
  if (!bounds || columns < 1 || rows < 1 || !polygons) return cells
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < columns; col++) {
      var geo = unproject(col + 0.5, row + 0.5, bounds, columns, rows)
      if (geo && pointInPolygons(geo.lon, geo.lat, polygons)) cells.push(row * columns + col)
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
      polygons: alert.polygons || [],
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
  var text = String(raw || "")
  if (responseTooLarge(text)) return []
  try {
    var data = JSON.parse(text)
    var polygons = extractPolygons(data && data.geometry)
    var out = []
    for (var i = 0; i < polygons.length; i++) {
      var simplified = []
      var polygon = polygons[i]
      for (var j = 0; j < polygon.length; j++) simplified.push(simplifyRing(polygon[j], 80))
      if (simplified.length > 0) out.push(simplified)
    }
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
    // Rebuild derived outlines as more zones arrive; preserve issued polygons.
    if (alert.geometryKind !== "zone" && ((alert.polygons && alert.polygons.length > 0) || (alert.rings && alert.rings.length > 0))) continue
    var urls = alert.zoneUrls || []
    var polygons = []
    for (var j = 0; j < urls.length; j++) {
      var got = cache && cache[urls[j]]
      if (!got) continue
      for (var k = 0; k < got.length; k++) polygons.push(got[k])
    }
    if (polygons.length > 0) {
      alert.polygons = polygons
      alert.rings = flattenPolygons(polygons)
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
    if (!alert || (alert.geometryKind !== "zone" && alert.rings && alert.rings.length > 0)) continue
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
    responseByteLimit: responseByteLimit,
    responseTooLarge: responseTooLarge,
    parseCollection: parseCollection,
    normalizeAlert: normalizeAlert,
    shortEvent: shortEvent,
    compareAlerts: compareAlerts,
    barLabel: barLabel,
    isWarningRank: isWarningRank,
    leadUrgent: leadUrgent,
    eventClass: eventClass,
    familyOf: familyOf,
    familyOptions: familyOptions,
    parseBoolSetting: parseBoolSetting,
    parseFilter: parseFilter,
    matchesFilter: matchesFilter,
    filterAlerts: filterAlerts,
    shouldNotify: shouldNotify,
    unexpired: unexpired,
    mergeSeen: mergeSeen,
    parseSeen: parseSeen,
    serializeSeen: serializeSeen,
    extractRings: extractRings,
    extractPolygons: extractPolygons,
    flattenPolygons: flattenPolygons,
    boundsFor: boundsFor,
    project: project,
    unproject: unproject,
    pointInRings: pointInRings,
    pointInPolygons: pointInPolygons,
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
