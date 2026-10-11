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
  "Coastal Flood Statement": "CSTL STMT",
  "Lakeshore Flood Warning": "LKSHR FLOOD",
  "Lakeshore Flood Watch": "LKSHR WATCH",
  "Lakeshore Flood Advisory": "LKSHR ADV",
  "Lakeshore Flood Statement": "LKSHR STMT",
  "Storm Surge Warning": "SURGE",
  "Storm Surge Watch": "SURGE WATCH",
  "Hurricane Warning": "HURRICANE",
  "Hurricane Watch": "CANE WATCH",
  "Tropical Storm Warning": "TROP STORM",
  "Tropical Storm Watch": "TROP WATCH",
  "Extreme Wind Warning": "EXT WIND",
  "Hurricane Force Wind Warning": "HF WIND",
  "Hurricane Force Wind Watch": "HF WIND WATCH",
  "Heavy Freezing Spray Warning": "HVY FZ SPRAY",
  "Heavy Freezing Spray Watch": "FZ SPRAY WATCH",
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
  "Avalanche Watch": "AVAL WATCH",
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
  "Cold Weather Advisory": "COLD ADV",
  "Extreme Cold Warning": "EXT COLD",
  "Extreme Cold Watch": "COLD WATCH",
  "Freeze Warning": "FREEZE",
  "Hard Freeze Warning": "HARD FRZ",
  "Frost Advisory": "FROST",
  "Excessive Heat Warning": "HEAT",
  "Excessive Heat Watch": "HEAT WATCH",
  "Extreme Heat Warning": "HEAT",
  "Extreme Heat Watch": "HEAT WATCH",
  "Heat Advisory": "HEAT ADV",
  "Red Flag Warning": "RED FLAG",
  "Extreme Fire Danger": "FIRE DANGER",
  "Special Marine Warning": "MARINE",
  "Gale Warning": "GALE",
  "Tsunami Warning": "TSUNAMI",
  "Air Quality Alert": "AIR QUALITY",
  "Child Abduction Emergency": "CHILD ABDUCT",
  "Civil Emergency Message": "CIVIL EMERG",
  "Local Area Emergency": "LOCAL EMERG",
  "Nuclear Power Plant Warning": "NUCLEAR PLANT",
  "Short Term Forecast": "SHORT TERM"
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

// A coordinate is a finite number or a numeric string. A blank string, null,
// or a boolean would all coerce to 0 and put the point in the Gulf of Guinea.
function coordinate(value, limit) {
  if (typeof value === "string") {
    if (value.replace(/^\s+|\s+$/g, "") === "") return null
  } else if (typeof value !== "number") {
    return null
  }
  var number = Number(value)
  if (!isFinite(number) || Math.abs(number) > limit) return null
  return number
}

// Table lookups by a name from the feed. A plain `table[name]` would also
// find "constructor" and the rest of Object.prototype.
function own(table, key) {
  return !!table && Object.prototype.hasOwnProperty.call(table, key)
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
    var latitude = coordinate(data.latitude, 90)
    var longitude = coordinate(data.longitude, 180)
    var hasCoordinates = latitude !== null && longitude !== null
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
  var latitude = coordinate(settings.latitude, 90)
  var longitude = coordinate(settings.longitude, 180)
  if (latitude === null || longitude === null) return unset
  var name = typeof settings.name === "string" ? settings.name.replace(/^\s+|\s+$/g, "") : ""
  return {
    name: name,
    latitude: latitude,
    longitude: longitude,
    source: "settings"
  }
}

function hasCoordinates(location) {
  return !!(location && coordinate(location.latitude, 90) !== null && coordinate(location.longitude, 180) !== null)
}

// Four decimals is about 11 m, which is all a point query needs, and it keeps
// a tiny value from being written in exponent form.
function pointText(value) {
  return String(Number(Number(value).toFixed(4)))
}

function alertsUrl(location) {
  if (!hasCoordinates(location)) return ""
  return "https://api.weather.gov/alerts/active?point="
    + encodeURIComponent(pointText(location.latitude)) + ","
    + encodeURIComponent(pointText(location.longitude))
}

// curl >= 8.4.0 enforces this even without Content-Length. Keep the parser
// guard in bytes too, without allocating another encoded copy of the body.
function responseByteLimit() { return 1024 * 1024 }

// Zone outlines are larger than alert feeds: coastal and island counties run
// past 2 MiB.
function zoneByteLimit() { return 4 * 1024 * 1024 }

function responseTooLarge(text, byteLimit) {
  var limit = byteLimit > 0 ? byteLimit : responseByteLimit()
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

// With --fail-with-body, an HTTP error still hands over the NWS problem
// document. Only a point outside NWS coverage is told apart; anything else
// stays a generic failure.
function outsideCoverage(raw) {
  var text = String(raw || "")
  if (text === "" || responseTooLarge(text)) return false
  try {
    var data = JSON.parse(text)
    return !!(data && typeof data === "object"
      && Number(data.status) === 400
      && /out of bounds/i.test(String(data.detail || "")))
  } catch (e) {
    return false
  }
}

// `unreadable` counts features that could not be read. They are left out so
// one damaged feature cannot hide a readable warning next to it.
function parseCollection(raw) {
  var empty = { alerts: [], error: "", unreadable: 0 }
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
    var unreadable = 0
    for (var i = 0; i < features.length; i++) {
      var alert = normalizeAlert(features[i])
      if (!alert) {
        unreadable++
        continue
      }
      if (alert.skip) continue
      alerts.push(alert)
    }
    // Nothing readable is a failed check, not an empty one.
    if (unreadable > 0 && alerts.length === 0) return { alerts: [], error: "unreadable NWS alert" }
    alerts.sort(compareAlerts)
    return { alerts: alerts, error: "", unreadable: unreadable }
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
    expires: String(properties.expires || ""),
    ends: String(properties.ends || ""),
    response: String(properties.response || ""),
    sender: String(properties.senderName || "").replace(/^\s+|\s+$/g, ""),
    threat: threatRank(properties),
    rings: rings,
    polygons: polygons,
    zoneUrls: extractZoneUrls(properties),
    zoneTotal: allZoneUrls(properties).length,
    zonesDrawn: 0,
    references: extractReferences(properties),
    geometryKind: kind
  }
}

// NWS keeps the event and severity when it raises a warning to "considerable"
// or to an emergency. The damage threat tag is the only field that changes.
var THREAT_RANK = { CONSIDERABLE: 1, DESTRUCTIVE: 2, CATASTROPHIC: 3 }

function threatRank(properties) {
  var parameters = properties && properties.parameters
  if (!parameters || typeof parameters !== "object") return 0
  var names = ["tornadoDamageThreat", "thunderstormDamageThreat", "flashFloodDamageThreat"]
  var rank = 0
  for (var i = 0; i < names.length; i++) {
    var values = parameters[names[i]]
    if (!values || !values.length) continue
    for (var j = 0; j < values.length; j++) {
      var key = String(values[j] || "").toUpperCase()
      if (own(THREAT_RANK, key) && THREAT_RANK[key] > rank) rank = THREAT_RANK[key]
    }
  }
  return rank
}

// Each NWS update is a new message with a new id. `references` names the
// messages it replaces, which is how an update is tied to what we have seen.
function extractReferences(properties) {
  var out = []
  var list = properties && properties.references
  if (!list || !list.length) return out
  for (var i = 0; i < list.length; i++) {
    var ref = list[i]
    var id = String((ref && typeof ref === "object" ? ref.identifier : ref) || "")
    if (id !== "" && out.indexOf(id) === -1) out.push(id)
  }
  return out
}

function eventIcon(event) {
  if (own(EVENT_ICON, event)) return EVENT_ICON[event]
  var text = String(event || "").toLowerCase()
  if (text.indexOf("tornado") !== -1) return ""
  if (text.indexOf("hurricane") !== -1 || text.indexOf("tropical") !== -1) return ""
  if (text.indexOf("thunder") !== -1) return ""
  if (text.indexOf("blizzard") !== -1) return ""
  if (/\bice\b/.test(text) || text.indexOf("freezing rain") !== -1) return ""
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

// Outlines are fetched one zone at a time, so only this many are drawn.
var ZONE_LIMIT = 24

function extractZoneUrls(properties) {
  return allZoneUrls(properties).slice(0, ZONE_LIMIT)
}

function allZoneUrls(properties) {
  var urls = []
  var seen = {}
  function add(url) {
    var value = String(url || "")
    if (!/^https:\/\/api\.weather\.gov\/zones\/[a-z]+\/[A-Z0-9]+$/.test(value)) return
    if (seen[value]) return
    seen[value] = true
    urls.push(value)
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

// A watch can name more zones than are drawn, and outlines arrive one at a
// time. The caption says so, so a partial shape is not read as the whole area.
function footprintCaption(kind, drawn, total) {
  if (kind === "polygon") return "NWS storm-based polygon"
  if (kind === "zone") {
    var all = Number(total) || 0
    var have = Number(drawn) || 0
    if (all > have && have > 0) return "NWS county / zone outline · " + have + " of " + all + " zones drawn"
    return "NWS county / zone outline"
  }
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

// Bar labels for events missing from SHORT_EVENT. Warnings read bare; a
// watch always says so, and advisories and statements say so when they fit.
var CLASS_TAG = { warning: "", watch: "WATCH", advisory: "ADV", statement: "STMT" }

var WORD_ABBR = {
  ABDUCTION: "ABDUCT", ADMINISTRATIVE: "ADMIN", AVALANCHE: "AVAL", COASTAL: "CSTL",
  CYCLONE: "CYC", EMERGENCY: "EMERG", ENFORCEMENT: "ENF", EVACUATION: "EVAC",
  EXTREME: "EXT", FLOOD: "FLD", FORECAST: "FCST", FREEZING: "FRZ", HAZARDOUS: "HAZ",
  HURRICANE: "HURR", IMMEDIATE: "NOW", LAKESHORE: "LKSHR", MATERIALS: "MAT",
  MESSAGE: "MSG", NUCLEAR: "NUC", OUTAGE: "OUT", RADIOLOGICAL: "RAD", SHELTER: "SHLTR",
  STAGNATION: "STAG", TELEPHONE: "PHONE", THUNDERSTORM: "TSTM", TROPICAL: "TROP",
  WEATHER: "WX"
}

var SHORT_LIMIT = 14

function shortEvent(event) {
  if (own(SHORT_EVENT, event)) return SHORT_EVENT[event]
  var text = String(event || "").replace(/^\s+|\s+$/g, "")
  var match = text.match(/^(.*?)\s+(Warning|Watch|Advisory|Statement)$/i)
  var base = match ? match[1] : text
  var tag = match ? CLASS_TAG[match[2].toLowerCase()] : ""
  var words = base.toUpperCase().split(/\s+/).filter(function(word) { return word !== "" })
  if (words.length === 0) return "ALERT"
  var label = fitLabel(words, tag)
  if (label === "" && tag !== "WATCH") label = fitLabel(words, "")
  if (label === "") {
    // Last resort: cut at a word boundary rather than mid-word.
    var raw = words.join(" ")
    var cut = raw.slice(0, SHORT_LIMIT + 1).lastIndexOf(" ")
    label = cut > 0 ? raw.slice(0, cut) : raw.slice(0, SHORT_LIMIT)
  }
  return label
}

// Shorten the longest words first, then drop trailing words. A watch keeps
// its tag; other tags are dropped by the caller when nothing fits.
function fitLabel(words, tag) {
  var list = words.slice()
  function joined() { return list.concat(tag ? [tag] : []).join(" ") }
  while (joined().length > SHORT_LIMIT) {
    var longest = -1
    for (var i = 0; i < list.length; i++) {
      if (!own(WORD_ABBR, list[i])) continue
      if (longest === -1 || list[i].length > list[longest].length) longest = i
    }
    if (longest === -1) break
    list[longest] = WORD_ABBR[list[longest]]
  }
  if (joined().length <= SHORT_LIMIT) return joined()
  if (tag !== "WATCH") return ""
  while (list.length > 1 && joined().length > SHORT_LIMIT) list.pop()
  return joined().length <= SHORT_LIMIT ? joined() : ""
}

function compareAlerts(a, b) {
  if (b.rank !== a.rank) return b.rank - a.rank
  if (b.urgencyRank !== a.urgencyRank) return b.urgencyRank - a.urgencyRank
  // Offices in different time zones write different UTC offsets, so compare
  // instants and not text.
  var aEnds = Date.parse(a.expires || "")
  var bEnds = Date.parse(b.expires || "")
  if (isFinite(aEnds) && isFinite(bEnds) && aEnds !== bEnds) return aEnds < bEnds ? -1 : 1
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

// Life-safety products whose names do not end in "Warning". Sorting them by
// suffix would file them with advisories, which are off by default.
var EMERGENCY_PRODUCTS = {
  "Evacuation Immediate": true,
  "Civil Emergency Message": true
}

function eventClass(event) {
  var name = String(event || "")
  if (own(WARNING_FOLLOWUPS, name)) return "warning"
  if (own(EMERGENCY_PRODUCTS, name) || /Emergency$/i.test(name)) return "warning"
  if (/Warning$/i.test(name)) return "warning"
  if (/Watch$/i.test(name)) return "watch"
  return "advisory"
}

function familyOf(event) {
  var text = String(event || "").toLowerCase()
  // Marine wind products named for their strength, not for a cyclone.
  if (text.indexOf("hurricane force wind") !== -1) return "wind"
  if (text.indexOf("tornado") !== -1) return "tornado"
  if (text.indexOf("thunder") !== -1 || text.indexOf("severe weather statement") !== -1) return "thunderstorm"
  if (text.indexOf("flash flood") !== -1) return "flashflood"
  if (text.indexOf("flood") !== -1 || text.indexOf("surge") !== -1) return "flood"
  if (text.indexOf("winter") !== -1 || /\bice\b/.test(text) || text.indexOf("blizzard") !== -1 || text.indexOf("snow") !== -1 || text.indexOf("freezing") !== -1) return "winter"
  if (text.indexOf("heat") !== -1) return "heat"
  if (text.indexOf("cold") !== -1 || text.indexOf("chill") !== -1 || text.indexOf("freeze") !== -1 || text.indexOf("frost") !== -1) return "cold"
  if (text.indexOf("fire") !== -1 || text.indexOf("red flag") !== -1) return "fire"
  if (text.indexOf("hurricane") !== -1 || text.indexOf("tropical") !== -1 || text.indexOf("typhoon") !== -1) return "tropical"
  if (text.indexOf("wind") !== -1 || text.indexOf("dust") !== -1) return "wind"
  // Marine wind products that do not say "wind".
  if (text.indexOf("gale") !== -1 || /^storm (warning|watch)$/.test(text)) return "wind"
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
  if (own(seen, alert.id)) return false
  if (continuesSeen(alert, seen)) return false
  // The first check only interrupts for a warning that needs action now.
  // Expected/Future urgency does not interrupt on startup.
  if (firstLoad) return eventClass(alert.event) === "warning" && alert.rank >= 3 && alert.urgencyRank >= 3
  if (alert.rank >= 3) return true
  if (alert.rank >= 2 && alert.urgencyRank >= 3) return true
  return false
}

// Critical notifications stay on screen, so they are kept for warnings that
// NWS rates Severe or Extreme. A Severe watch is still only a watch.
function noticeUrgency(alert) {
  if (!alert) return "normal"
  return eventClass(alert.event) === "warning" && isWarningRank(alert.rank) ? "critical" : "normal"
}

// An update to an alert we already announced stays quiet unless it changes
// the event (a watch upgraded to a warning) or raises the severity, the
// urgency, or the damage threat. It is compared with the message it replaced
// most recently, so a warning that eases and then worsens again still notifies.
function continuesSeen(alert, seen) {
  if (!alert || !seen) return false
  var refs = alert.references || []
  var prior = null
  for (var i = 0; i < refs.length; i++) {
    if (!own(seen, refs[i])) continue
    var entry = seen[refs[i]]
    if (!entry || typeof entry !== "object" || !entry.event) continue
    if (prior === null || entry.at > prior.at
        || (entry.at === prior.at && Number(entry.rank) > Number(prior.rank))) prior = entry
  }
  if (prior === null) return false
  return prior.event === alert.event
    && (Number(alert.rank) || 0) <= Number(prior.rank)
    && (Number(alert.urgencyRank) || 0) <= Number(prior.urgency)
    && (Number(alert.threat) || 0) <= Number(prior.threat)
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

// Seen entries record when an alert was seen and what it was, so a later
// update can be compared with it. Older files stored only the time, or left
// out urgency and threat; those read as the highest value so an upgrade of the
// plugin does not re-announce alerts that were already seen.
function seenTime(entry) {
  if (entry && typeof entry === "object") return Number(entry.at)
  return Number(entry)
}

function seenEntry(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    var at = Number(value.at)
    if (!isFinite(at)) return null
    return {
      at: at,
      event: String(value.event || ""),
      rank: Number(value.rank) || 0,
      urgency: knownLevel(value.urgency),
      threat: knownLevel(value.threat)
    }
  }
  var stamp = Number(value)
  return isFinite(stamp) ? { at: stamp, event: "", rank: 0, urgency: 3, threat: 3 } : null
}

function knownLevel(value) {
  if (typeof value !== "number" || !isFinite(value)) return 3
  return value
}

function mergeSeen(seen, alerts, nowMs, maxAgeMs) {
  var next = {}
  var age = isFinite(Number(maxAgeMs)) ? Number(maxAgeMs) : 172800000
  var now = Number(nowMs)
  if (seen && typeof seen === "object") {
    for (var key in seen) {
      var entry = seenEntry(seen[key])
      if (entry && isFinite(now) && (now - entry.at) <= age) next[key] = entry
    }
  }
  if (alerts) {
    for (var i = 0; i < alerts.length; i++) {
      var alert = alerts[i]
      if (!alert || !alert.id) continue
      next[alert.id] = {
        at: isFinite(now) ? now : Date.now(),
        event: String(alert.event || ""),
        rank: Number(alert.rank) || 0,
        urgency: Number(alert.urgencyRank) || 0,
        threat: Number(alert.threat) || 0
      }
    }
  }
  return next
}

// What the seen-file holds apart from the times. The file is rewritten when
// this changes, and otherwise only now and then to keep the times fresh.
function seenSignature(seen) {
  var keys = []
  if (seen && typeof seen === "object") {
    for (var key in seen) {
      var entry = seen[key] || {}
      keys.push([key, entry.event, entry.rank, entry.urgency, entry.threat].join("|"))
    }
  }
  keys.sort()
  return keys.join("\n")
}

function parseSeen(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    if (!data || typeof data !== "object") return {}
    var seen = data.seen
    if (!seen || typeof seen !== "object" || Array.isArray(seen)) return {}
    var out = {}
    for (var key in seen) {
      var entry = seenEntry(seen[key])
      if (entry) out[key] = entry
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
  if (!coordinates && type !== "GeometryCollection") return []
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
  // Some county outlines arrive as a collection of polygons and multipolygons.
  if (type === "GeometryCollection" && geometry.geometries && geometry.geometries.length) {
    var collected = []
    for (var g = 0; g < geometry.geometries.length; g++) {
      var member = extractPolygons(geometry.geometries[g])
      for (var m = 0; m < member.length; m++) collected.push(member[m])
    }
    return collected
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

// Each polygon is tested only against the cells under its own bounding box,
// so a county made of hundreds of small islands costs little.
function rasterCells(polygons, bounds, columns, rows) {
  var cells = []
  if (!bounds || columns < 1 || rows < 1 || !polygons) return cells
  var filled = {}
  for (var i = 0; i < polygons.length; i++) {
    var polygon = polygons[i]
    var outer = polygon && polygon[0]
    if (!outer || outer.length < 3) continue
    var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
    for (var p = 0; p < outer.length; p++) {
      if (outer[p][0] < minLon) minLon = outer[p][0]
      if (outer[p][0] > maxLon) maxLon = outer[p][0]
      if (outer[p][1] < minLat) minLat = outer[p][1]
      if (outer[p][1] > maxLat) maxLat = outer[p][1]
    }
    var topLeft = project(minLon, maxLat, bounds, columns, rows)
    var bottomRight = project(maxLon, minLat, bounds, columns, rows)
    if (!topLeft || !bottomRight) continue
    var col0 = Math.max(0, Math.floor(topLeft.x))
    var col1 = Math.min(columns - 1, Math.floor(bottomRight.x))
    var row0 = Math.max(0, Math.floor(topLeft.y))
    var row1 = Math.min(rows - 1, Math.floor(bottomRight.y))
    var single = [polygon]
    for (var row = row0; row <= row1; row++) {
      for (var col = col0; col <= col1; col++) {
        var key = row * columns + col
        if (filled[key]) continue
        var geo = unproject(col + 0.5, row + 0.5, bounds, columns, rows)
        if (geo && pointInPolygons(geo.lon, geo.lat, single)) filled[key] = true
      }
    }
  }
  for (var index = 0; index < columns * rows; index++) {
    if (filled[index]) cells.push(index)
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

// An island county can hold hundreds of polygons, most smaller than one map
// cell. Keep the largest ones.
var ZONE_POLYGON_LIMIT = 64

function largestPolygons(polygons, limit) {
  if (polygons.length <= limit) return polygons
  var sized = []
  for (var i = 0; i < polygons.length; i++) {
    var outer = polygons[i][0]
    var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
    for (var p = 0; p < outer.length; p++) {
      if (outer[p][0] < minLon) minLon = outer[p][0]
      if (outer[p][0] > maxLon) maxLon = outer[p][0]
      if (outer[p][1] < minLat) minLat = outer[p][1]
      if (outer[p][1] > maxLat) maxLat = outer[p][1]
    }
    sized.push({ polygon: polygons[i], area: (maxLon - minLon) * (maxLat - minLat) })
  }
  sized.sort(function(a, b) { return b.area - a.area })
  var out = []
  for (var k = 0; k < limit; k++) out.push(sized[k].polygon)
  return out
}

function parseZoneDocument(raw) {
  var text = String(raw || "")
  if (responseTooLarge(text, zoneByteLimit())) return []
  try {
    var data = JSON.parse(text)
    var polygons = largestPolygons(extractPolygons(data && data.geometry), ZONE_POLYGON_LIMIT)
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
    var drawn = 0
    for (var j = 0; j < urls.length; j++) {
      var got = own(cache, urls[j]) ? cache[urls[j]] : null
      if (!got) continue
      drawn++
      for (var k = 0; k < got.length; k++) polygons.push(got[k])
    }
    alert.zonesDrawn = drawn
    if (polygons.length > 0) {
      alert.polygons = polygons
      alert.rings = flattenPolygons(polygons)
      alert.geometryKind = "zone"
    }
  }
  return alerts
}

// A zone that failed is asked for again after 5 minutes, then 10, 20, and so
// on up to 6 hours, so one that never loads is not downloaded on every check.
function zoneRetryDelayMs(failures) {
  var count = Math.max(1, Number(failures) || 1)
  return Math.min(300000 * Math.pow(2, Math.min(count - 1, 10)), 21600000)
}

function noteZoneFailure(failures, url, nowMs) {
  var next = {}
  for (var key in failures) next[key] = failures[key]
  var count = (own(next, url) ? next[url].count : 0) + 1
  next[url] = { count: count, retryAt: Number(nowMs) + zoneRetryDelayMs(count) }
  return next
}

// `failures` and `nowMs` are optional; without them every uncached zone is due.
function missingZoneUrls(alerts, cache, failures, nowMs) {
  var urls = []
  var seen = {}
  if (!alerts) return urls
  for (var i = 0; i < alerts.length; i++) {
    var alert = alerts[i]
    if (!alert || (alert.geometryKind !== "zone" && alert.rings && alert.rings.length > 0)) continue
    var list = alert.zoneUrls || []
    for (var j = 0; j < list.length; j++) {
      var url = list[j]
      if (!url || seen[url] || own(cache, url)) continue
      if (own(failures, url) && failures[url].retryAt > Number(nowMs)) continue
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

// "Clear" is only true for as long as checks keep landing. Three missed
// intervals means the last answer is too old to stand behind.
function isStale(lastSuccessMs, nowMs, refreshMs) {
  var last = Number(lastSuccessMs)
  var now = Number(nowMs)
  if (!(last > 0) || !isFinite(now)) return false
  return now - last > 3 * Math.max(30000, Number(refreshMs) || 60000) + 30000
}

function clampRefreshSeconds(value) {
  var seconds = parseInt(value, 10)
  if (!isFinite(seconds) || seconds <= 0) seconds = 60
  return Math.min(86400, Math.max(30, seconds))
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
    zoneByteLimit: zoneByteLimit,
    coordinate: coordinate,
    threatRank: threatRank,
    seenSignature: seenSignature,
    zoneRetryDelayMs: zoneRetryDelayMs,
    noteZoneFailure: noteZoneFailure,
    isStale: isStale,
    clampRefreshSeconds: clampRefreshSeconds,
    parseCollection: parseCollection,
    outsideCoverage: outsideCoverage,
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
    noticeUrgency: noticeUrgency,
    continuesSeen: continuesSeen,
    extractReferences: extractReferences,
    seenTime: seenTime,
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
