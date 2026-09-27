import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model
import "Demo.js" as Demo

// One poller for every bar. The bar builds a widget per monitor, so fetching,
// the seen-file, and notifications live here once; panels only present it.
Item {
  id: root
  visible: false

  // Injected by the shell host. Settings are pushed by the bar widget.
  property var shell: null
  property var manifest: null
  property var settings: ({})
  // False until a bar widget hands over its settings, so the first check
  // never runs with default filters or the wrong location.
  property bool configured: false

  property string locationRaw: ""
  property var incomingAlerts: []
  property var alerts: []
  property var seen: ({})
  property int selectedIndex: 0
  property string fetchError: ""
  property bool fetchInFlight: false
  property bool hasSuccessfulFetch: false
  property int fetchGeneration: 0
  property int requestGeneration: -1
  property string responseBody: ""
  property bool responseReady: false
  property bool requestExited: false
  property int requestExitCode: -1
  property bool seenHydrated: false
  property bool firstLoad: true
  property string lastUpdated: ""
  property int demoIndex: 0
  property var zoneAtlas: ({})
  property var zoneCache: ({})
  property var zoneQueue: []
  property string zoneFetchUrl: ""
  property bool zoneFetchInFlight: false
  property string zoneResponseBody: ""
  property bool zoneResponseReady: false
  property bool zoneRequestExited: false
  property int zoneRequestExitCode: -1
  property string selectedId: ""
  property bool heldExpired: false
  // NWS rejected the point as outside its coverage. Retrying cannot help
  // until the location changes, so the timer stops asking.
  property bool outsideCoverage: false
  property bool notifyWhenReady: false
  property bool seenRetryDone: false
  property int zoneGeneration: 0
  property int zoneRequestGeneration: -1

  readonly property var location: Model.parseLocation(root.locationRaw, root.settings)
  readonly property bool located: Model.hasCoordinates(location)
  readonly property string locationKey: located
    ? String(location.latitude) + "," + String(location.longitude)
    : ""
  readonly property int alertCount: alerts.length
  readonly property var selected: alertCount === 0 ? null : alerts[Math.max(0, Math.min(selectedIndex, alertCount - 1))]
  readonly property string selectedIcon: selected ? selected.icon : ""
  readonly property bool selectedUrgent: !root.demoMode && Model.leadUrgent(selected)
  // The bar stays on the most dangerous alert. Selection changes the panel only.
  readonly property string barIcon: alertCount > 0 && alerts[0] ? alerts[0].icon : ""
  readonly property bool warningActive: !root.demoMode && alertCount > 0 && Model.leadUrgent(alerts[0])
  readonly property string barMood: {
    if (root.demoMode) return "demo"
    if (!root.located || root.outsideCoverage) return "setup"
    if (root.alertCount > 0) return "alert"
    if (root.fetchError !== "") return "unavailable"
    if (root.filteredOut) return "filtered"
    if (!root.hasSuccessfulFetch) return "checking"
    return "clear"
  }
  readonly property string barText: {
    if (root.alertCount > 0) return ""
    if (root.demoMode) return "DEMO"
    if (!root.located || root.outsideCoverage) return "LOCATION"
    if (root.fetchError !== "") return "NO DATA"
    if (root.filteredOut) return String(root.incomingAlerts.length) + " HIDDEN"
    return ""
  }
  readonly property string barTooltip: {
    if (root.demoMode)
      return "Acid Alerts · DEMO · " + (root.demoScene ? root.demoScene.title : "sample alerts")
    if (root.alertCount > 0 && root.fetchError === "") {
      var lead = root.alerts[0]
      var extra = root.alertCount > 1 ? " · " + root.alertCount + " alerts in this area" : ""
      return "Acid Alerts · " + (lead ? lead.headline : "") + extra
    }
    return "Acid Alerts · " + root.heroMeta()
  }
  readonly property var mapLayers: Model.mapLayers(alerts, selected ? selected.id : "")
  readonly property int refreshMs: Math.max(30000, (parseInt(setting("refreshSeconds", 60), 10) || 60) * 1000)
  readonly property bool demoMode: Demo.demoEnabled(root.settings)
  readonly property var filter: Model.parseFilter(root.settings)
  readonly property bool filteredOut: !demoMode && !heldExpired && incomingAlerts.length > 0 && alertCount === 0
  readonly property var demoScenes: Demo.scenes(root.zoneAtlas)
  readonly property var demoScene: demoScenes.length === 0
    ? null
    : demoScenes[Math.max(0, Math.min(demoIndex, demoScenes.length - 1))]

  function setting(name, fallback) {
    var value = root.settings ? root.settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  function configure(values) {
    root.settings = values || ({})
    if (root.configured) return
    root.configured = true
    Qt.callLater(root.refresh)
  }

  function reloadLocation() {
    locationFile.reload()
  }

  function refresh() {
    if (!root.configured) return
    if (root.demoMode) {
      root.applyDemo()
      return
    }
    if (!root.located) {
      root.alerts = []
      root.fetchError = ""
      return
    }
    if (fetchProc.running || root.fetchInFlight) return
    root.requestGeneration = root.fetchGeneration
    root.responseBody = ""
    root.responseReady = false
    root.requestExited = false
    root.requestExitCode = -1
    fetchProc.command = [
      "curl", "-q", "-sS", "--fail-with-body", "--max-time", "10",
      "--max-filesize", String(Model.responseByteLimit()),
      "-A", Model.userAgent(),
      "-H", "Accept: application/geo+json",
      Model.alertsUrl(root.location)
    ]
    root.fetchInFlight = true
    fetchProc.running = true
  }

  // Invalidate results when switching locations or entering/leaving demo mode.
  function resetSource() {
    root.fetchGeneration += 1
    root.zoneGeneration += 1
    root.zoneQueue = []
    root.hasSuccessfulFetch = false
    root.lastUpdated = ""
    root.fetchError = ""
    root.heldExpired = false
    root.outsideCoverage = false
    root.incomingAlerts = []
    root.alerts = []
    root.selectedId = ""
    root.firstLoad = true
    root.notifyWhenReady = false
    root.refresh()
  }

  // stdout and exit callbacks may arrive in either order. Never accept a body
  // from a failed request, or one started for a different location/mode.
  function finishFetch() {
    if (!root.fetchInFlight || !root.requestExited || !root.responseReady) return
    root.fetchInFlight = false
    var body = root.responseBody
    root.responseBody = ""
    if (root.requestGeneration !== root.fetchGeneration) {
      Qt.callLater(root.refresh)
      return
    }
    if (root.requestExitCode !== 0) {
      root.outsideCoverage = root.requestExitCode === 22 && Model.outsideCoverage(body)
      root.fetchError = root.outsideCoverage ? "Outside NWS coverage" : "NWS is unreachable"
      root.applyVisible()
      return
    }
    root.outsideCoverage = false
    root.applyPayload(body)
  }

  function applyDemo() {
    var scene = root.demoScene
    if (!scene) {
      root.alerts = []
      return
    }
    var parsed = Model.parseCollection(JSON.stringify({
      type: "FeatureCollection",
      features: scene.features
    }))
    root.fetchError = ""
    root.incomingAlerts = parsed.alerts
    root.applyVisible()
    root.lastUpdated = "demo"
    root.firstLoad = false
  }

  function moveDemo(delta) {
    if (!root.demoMode || root.demoScenes.length === 0) return
    var next = root.demoIndex + delta
    var last = root.demoScenes.length - 1
    if (next < 0) next = last
    if (next > last) next = 0
    root.demoIndex = next
    root.applyDemo()
  }

  function applyPayload(raw) {
    var parsed = Model.parseCollection(raw)
    if (parsed.error && parsed.alerts.length === 0) {
      root.fetchError = parsed.error
      root.applyVisible()
      return
    }
    root.fetchError = ""
    root.heldExpired = false
    Model.attachZoneRings(parsed.alerts, root.zoneCache)
    root.incomingAlerts = parsed.alerts
    root.applyVisible()
    root.hasSuccessfulFetch = true
    root.lastUpdated = Qt.formatDateTime(new Date(), "MMM d h:mm AP")
    if (root.seenHydrated) {
      notifyNewAlerts(root.alerts)
      root.firstLoad = false
      persistSeen(parsed.alerts)
      root.notifyWhenReady = false
    } else {
      root.notifyWhenReady = true
    }
    root.enqueueZones(parsed.alerts)
  }

  // A fetch can finish before the seen-file loads. Hold the notice until then
  // so a warning is not marked seen without ever notifying.
  function releasePendingNotice() {
    if (!root.seenHydrated || !root.notifyWhenReady) return
    root.notifyWhenReady = false
    notifyNewAlerts(root.alerts)
    root.firstLoad = false
    persistSeen(root.incomingAlerts)
  }

  // A later reload must not forget alerts this session already recorded.
  function rememberSeen(raw) {
    var loaded = Model.parseSeen(raw)
    if (root.seen) {
      for (var key in root.seen) {
        if (loaded[key] === undefined || Model.seenTime(root.seen[key]) > Model.seenTime(loaded[key]))
          loaded[key] = root.seen[key]
      }
    }
    root.seen = loaded
    root.seenHydrated = true
    root.releasePendingNotice()
  }

  function applyVisible() {
    var source = root.incomingAlerts || []
    if (root.fetchError !== "" && !root.demoMode) {
      var live = Model.unexpired(source, Date.now())
      root.heldExpired = live.length === 0 && source.length > 0
      source = live
    } else {
      root.heldExpired = false
    }
    var next = root.demoMode ? source : Model.filterAlerts(source, root.filter)
    var keep = 0
    if (root.selectedId !== "") {
      for (var i = 0; i < next.length; i++) {
        if (next[i] && next[i].id === root.selectedId) {
          keep = i
          break
        }
      }
    }
    if (next.length === 0) keep = 0
    else if (!next[keep] || next[keep].id !== root.selectedId) keep = 0
    root.alerts = next
    root.selectedIndex = keep
    if (next.length > 0) root.selectedId = next[keep].id
  }

  function enqueueZones(nextAlerts) {
    var missing = Model.missingZoneUrls(nextAlerts, root.zoneCache)
    if (missing.length === 0) return
    var queue = root.zoneQueue.slice()
    for (var i = 0; i < missing.length; i++) {
      if (queue.indexOf(missing[i]) === -1) queue.push(missing[i])
    }
    root.zoneQueue = queue
    root.pumpZones()
  }

  function pumpZones() {
    if (root.demoMode) return
    if (zoneProc.running || root.zoneFetchInFlight) return
    if (root.zoneQueue.length === 0) return
    var url = root.zoneQueue[0]
    root.zoneQueue = root.zoneQueue.slice(1)
    root.zoneFetchUrl = url
    root.zoneRequestGeneration = root.zoneGeneration
    root.zoneResponseBody = ""
    root.zoneResponseReady = false
    root.zoneRequestExited = false
    root.zoneRequestExitCode = -1
    root.zoneFetchInFlight = true
    zoneProc.command = [
      "curl", "-q", "-fsS", "--max-time", "10",
      "--max-filesize", String(Model.responseByteLimit()),
      "-A", Model.userAgent(),
      "-H", "Accept: application/geo+json",
      url
    ]
    zoneProc.running = true
  }

  // Drain both callbacks before starting another zone, including failed transfers.
  function finishZoneFetch() {
    if (!root.zoneFetchInFlight || !root.zoneRequestExited || !root.zoneResponseReady) return
    root.zoneFetchInFlight = false
    var body = root.zoneResponseBody
    root.zoneResponseBody = ""
    if (root.zoneRequestGeneration !== root.zoneGeneration) {
      Qt.callLater(root.pumpZones)
      return
    }
    if (root.zoneRequestExitCode === 0 && !root.demoMode)
      root.applyZonePayload(body)
    Qt.callLater(root.pumpZones)
  }

  function applyZonePayload(raw) {
    var rings = Model.parseZoneDocument(raw)
    if (rings.length === 0) return
    var nextCache = {}
    for (var key in root.zoneCache) nextCache[key] = root.zoneCache[key]
    nextCache[root.zoneFetchUrl] = rings
    root.zoneCache = nextCache
    var next = root.incomingAlerts.slice()
    Model.attachZoneRings(next, root.zoneCache)
    root.incomingAlerts = next
    root.applyVisible()
  }

  function notifyNewAlerts(nextAlerts) {
    if (!root.seenHydrated || root.demoMode) return
    for (var i = 0; i < nextAlerts.length; i++) {
      var alert = nextAlerts[i]
      if (!Model.shouldNotify(alert, root.seen, root.firstLoad)) continue
      sendNotice(alert)
    }
  }

  function persistSeen(nextAlerts) {
    root.seen = Model.mergeSeen(root.seen, nextAlerts, Date.now(), 172800000)
    seenFile.setText(Model.serializeSeen(root.seen) + "\n")
  }

  function sendNotice(alert) {
    var urgency = Model.noticeUrgency(alert)
    Quickshell.execDetached([
      "omarchy-notification-send",
      "--app-name", "Acid Alerts",
      "-u", urgency,
      "-g", alert.icon || "󰀦",
      alert.event,
      alert.headline,
      "--exec", "omarchy-shell", "shell", "summon", "neil.acid-alerts", "{}"
    ])
  }

  function selectIndex(index) {
    if (index < 0 || index > root.alertCount - 1) return
    root.selectedIndex = index
    if (root.alerts[index]) root.selectedId = root.alerts[index].id
  }

  function moveSelection(delta) {
    if (root.alertCount === 0) return
    var next = root.selectedIndex + delta
    if (next < 0) next = 0
    if (next > root.alertCount - 1) next = root.alertCount - 1
    root.selectIndex(next)
  }

  function formatWhen(iso) {
    if (!iso) return ""
    var date = new Date(iso)
    if (isNaN(date.getTime())) return ""
    var sameDay = date.toDateString() === (new Date()).toDateString()
    return Qt.formatDateTime(date, sameDay ? "h:mm AP" : "MMM d h:mm AP")
  }

  // `ends` is when the hazard is expected to end. `expires` is when this
  // message must be replaced. They are often different times.
  function whenLine(alert) {
    if (!alert) return ""
    var ends = root.formatWhen(alert.ends)
    var expires = root.formatWhen(alert.expires)
    if (ends !== "" && expires !== "" && ends !== expires)
      return "ends " + ends + " · message expires " + expires
    if (ends !== "") return "ends " + ends
    if (expires !== "") return "message expires " + expires
    return ""
  }

  function responseLabel() {
    if (!root.selected) return ""
    var response = String(root.selected.response || "")
    if (response === "" || response === "None" || response === "Unknown") return ""
    return response.toUpperCase()
  }

  function statusHeading() {
    if (!root.demoMode && !root.located) return "SET A LOCATION"
    if (!root.demoMode && root.outsideCoverage) return "OUTSIDE NWS COVERAGE"
    if (root.selected) return root.selected.event.toUpperCase()
    if (root.demoMode) return "DEMO"
    if (root.fetchError !== "") return "ALERTS UNAVAILABLE"
    if (!root.hasSuccessfulFetch) return "CHECKING ALERTS"
    if (root.fetchInFlight) return "UPDATING ALERTS"
    return "NO MATCHING ALERTS"
  }

  function heroMeta() {
    if (root.demoMode && root.demoScene)
      return "DEMO · " + root.demoScene.title
    if (!root.located) return "Set a weather location to watch this place."
    if (root.outsideCoverage)
      return "NWS alerts cover the United States and its territories. Choose a location there with omarchy-weather-location."
    if (root.fetchError !== "") {
      if (root.heldExpired)
        return root.fetchError + " · previous alerts have expired; current conditions unknown"
      if (root.hasSuccessfulFetch && root.alertCount > 0)
        return root.fetchError + " · showing last known data; current conditions unknown"
      return root.fetchError + " · current conditions unknown"
    }
    if (!root.hasSuccessfulFetch) return "Waiting for NWS data for " + locationLabel()
    // A routine refresh must not replace what the panel already knows.
    if (root.filteredOut) return root.incomingAlerts.length + " in " + locationLabel() + ", hidden by filters"
    if (root.alertCount === 0) {
      if (root.fetchInFlight) return "Checking NWS for " + locationLabel()
      return "No alerts match your filters in " + locationLabel()
    }
    var bits = []
    if (root.alertCount > 1)
      bits.push(String(root.alertCount - 1) + (root.alertCount === 2 ? " other alert" : " other alerts"))
    if (root.selected) {
      bits.push(root.selected.severity.toUpperCase())
      if (root.selected.certainty && root.selected.certainty !== "Unknown")
        bits.push(root.selected.certainty.toUpperCase())
      var when = root.whenLine(root.selected)
      if (when !== "") bits.push(when)
    }
    return bits.join(" · ")
  }

  function footerText() {
    if (root.demoMode) {
      var n = root.demoScenes.length
      var here = n === 0 ? 0 : root.demoIndex + 1
      return "DEMO " + here + "/" + n + " · [ previous  ] next · not a live NWS product"
    }
    if (root.located)
      return "NWS · " + locationLabel() + (root.lastUpdated !== "" ? " · last checked " + root.lastUpdated : "")
    return "NWS · set a location with omarchy-weather-location"
  }

  function locationLabel() {
    if (root.location && root.location.name) return root.location.name
    if (root.located) return Number(root.location.latitude).toFixed(2) + ", " + Number(root.location.longitude).toFixed(2)
    return "your area"
  }

  onLocationKeyChanged: root.resetSource()
  onDemoModeChanged: root.resetSource()
  onSettingsChanged: root.applyVisible()
  onZoneAtlasChanged: if (root.demoMode) root.applyDemo()

  FileView {
    id: locationFile
    path: Quickshell.env("HOME") + "/.local/state/omarchy/settings/weather.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.locationRaw = text()
    onLoadFailed: root.locationRaw = ""
  }

  FileView {
    id: zonesFile
    path: Qt.resolvedUrl("demo/zones.json").toString().replace(/^file:\/\//, "")
    watchChanges: false
    printErrors: false
    onLoaded: root.zoneAtlas = Model.parseZoneAtlas(text())
    onLoadFailed: root.zoneAtlas = ({})
  }

  FileView {
    id: seenFile
    path: Quickshell.env("HOME") + "/.local/state/omarchy/acid-alerts.json"
    watchChanges: false
    printErrors: false
    onLoaded: root.rememberSeen(text())
    onLoadFailed: {
      if (root.seenHydrated || !root.seenRetryDone) return
      root.seen = {}
      root.seenHydrated = true
      root.releasePendingNotice()
    }
  }

  Timer {
    interval: 1500
    running: true
    repeat: false
    onTriggered: {
      locationFile.reload()
      zonesFile.reload()
      // The state file is often unreadable for a moment at startup. Give up
      // only after this retry, so an early failure cannot notify as if the
      // seen-file were empty.
      root.seenRetryDone = true
      if (!root.seenHydrated) seenFile.reload()
    }
  }

  Timer {
    interval: root.refreshMs
    running: root.configured
    repeat: true
    onTriggered: if (!root.outsideCoverage) root.refresh()
  }

  // Expiration must not wait for another (possibly very infrequent) poll.
  Timer {
    interval: 1000
    running: !root.demoMode && root.fetchError !== "" && root.alertCount > 0
    repeat: true
    onTriggered: root.applyVisible()
  }

  Process {
    id: zoneProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.zoneResponseBody = text
        root.zoneResponseReady = true
        root.finishZoneFetch()
      }
    }
    onExited: function(exitCode) {
      root.zoneRequestExitCode = exitCode
      root.zoneRequestExited = true
      root.finishZoneFetch()
    }
  }

  Process {
    id: fetchProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.responseBody = text
        root.responseReady = true
        root.finishFetch()
      }
    }
    onExited: function(exitCode) {
      root.requestExitCode = exitCode
      root.requestExited = true
      root.finishFetch()
    }
  }

  Component.onCompleted: {
    locationFile.reload()
    seenFile.reload()
    zonesFile.reload()
  }
}
