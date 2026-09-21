import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model
import "Demo.js" as Demo

Panel {
  id: root
  moduleName: "neil.acid-alerts"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
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
  property bool filtersOpen: false
  property string selectedId: ""
  property bool heldExpired: false
  property bool notifyWhenReady: false
  property bool seenRetryDone: false
  property int zoneGeneration: 0
  property int zoneRequestGeneration: -1

  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property color contentUrgent: bar ? bar.urgent : Color.urgent
  readonly property color contentAccent: Color.accent
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color dim: Qt.darker(contentForeground, 1.55)
  readonly property var location: Model.parseLocation(root.locationRaw, root.settings)
  readonly property bool located: Model.hasCoordinates(location)
  readonly property string locationKey: located
    ? String(location.latitude) + "," + String(location.longitude)
    : ""
  readonly property int alertCount: alerts.length
  readonly property var selected: alertCount === 0 ? null : alerts[Math.max(0, Math.min(selectedIndex, alertCount - 1))]
  readonly property string label: {
    var text = Model.barLabel(alerts, !!(bar && bar.vertical))
    if (root.demoMode && text !== "" && !(bar && bar.vertical)) return "DEMO · " + text
    return text
  }
  // The bar stays on the most dangerous alert. Selection changes the panel only.
  readonly property string barIcon: alertCount > 0 && alerts[0] ? alerts[0].icon : ""
  readonly property bool warningActive: !root.demoMode && alertCount > 0 && Model.leadUrgent(alerts[0])
  readonly property string barMood: {
    if (root.demoMode) return "demo"
    if (!root.located) return "setup"
    if (root.alertCount > 0) return "alert"
    if (root.fetchError !== "") return "unavailable"
    if (root.filteredOut) return "filtered"
    if (!root.hasSuccessfulFetch) return "checking"
    return "clear"
  }
  readonly property string barText: {
    if (root.alertCount > 0) return ""
    if (root.demoMode) return "DEMO"
    if (!root.located) return "LOCATION"
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
  readonly property var familyChoices: Model.familyOptions()
  readonly property bool filtersVisible: alertCount === 0 || filtersOpen
  readonly property int mapPixels: {
    var avail = panel.availableCardHeight
    if (avail > 0 && avail < 400) return Style.space(88)
    if (avail > 0 && avail < 560) return Style.space(108)
    return Style.space(128)
  }
  readonly property var demoScenes: Demo.scenes(root.zoneAtlas)
  readonly property var demoScene: demoScenes.length === 0
    ? null
    : demoScenes[Math.max(0, Math.min(demoIndex, demoScenes.length - 1))]

  function open() {
    root.controller.show()
    locationFile.reload()
    root.refresh()
    Qt.callLater(function() {
      if (root.opened) setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && typeof root.bar.setCenterHoverRevealSuppressed === "function")
      root.bar.setCenterHoverRevealSuppressed(value)
    else if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function refresh() {
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
      "curl", "-q", "-fsS", "--max-time", "10",
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
      root.fetchError = "NWS is unreachable"
      root.applyVisible()
      return
    }
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
        if (loaded[key] === undefined || Number(root.seen[key]) > Number(loaded[key]))
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

  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]
    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
    root.applyVisible()
  }

  function setClass(key, value) {
    var patch = {}
    patch[key] = value
    root.persistSettings(patch)
  }

  function toggleFamily(id) {
    var current = (root.filter.families || []).slice()
    var at = current.indexOf(id)
    if (at === -1) current.push(id)
    else current.splice(at, 1)
    root.persistSettings({ families: current })
  }

  function familySelected(id) {
    var list = root.filter.families || []
    return list.indexOf(id) !== -1
  }

  function toggleFilters() {
    root.filtersOpen = !root.filtersOpen
  }

  function filterSummary() {
    var parts = []
    if (root.filter.warnings) parts.push("Warnings")
    if (root.filter.watches) parts.push("Watches")
    if (root.filter.advisories) parts.push("Advisories")
    if (root.filter.families.length > 0) parts.push(String(root.filter.families.length) + " families")
    if (parts.length === 0) return "nothing selected"
    return parts.join(" · ")
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
    var urgency = Model.isWarningRank(alert.rank) ? "critical" : "normal"
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

  function moveSelection(delta) {
    if (root.alertCount === 0) return
    var next = root.selectedIndex + delta
    if (next < 0) next = 0
    if (next > root.alertCount - 1) next = root.alertCount - 1
    root.selectedIndex = next
    if (root.alerts[next]) root.selectedId = root.alerts[next].id
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
    if (root.fetchError !== "") {
      if (root.heldExpired)
        return root.fetchError + " · previous alerts have expired; current conditions unknown"
      if (root.hasSuccessfulFetch && root.alertCount > 0)
        return root.fetchError + " · showing last known data; current conditions unknown"
      return root.fetchError + " · current conditions unknown"
    }
    if (!root.hasSuccessfulFetch) return "Waiting for NWS data for " + locationLabel()
    if (root.fetchInFlight) return "Checking NWS for " + locationLabel()
    if (root.filteredOut) return root.incomingAlerts.length + " in " + locationLabel() + ", hidden by filters"
    if (root.alertCount === 0) return "No alerts match your filters in " + locationLabel()
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

  function severityColor(alert) {
    if (!alert) return root.dim
    if (Model.eventClass(alert.event) === "warning" || alert.rank >= 3) return root.contentUrgent
    if (Model.eventClass(alert.event) === "watch" || alert.rank >= 2) return root.contentAccent
    return root.dim
  }

  onLocationKeyChanged: root.resetSource()
  onDemoModeChanged: root.resetSource()
  onSettingsChanged: root.applyVisible()
  onAlertCountChanged: if (root.alertCount > 0) root.filtersOpen = false
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
    running: true
    repeat: true
    onTriggered: root.refresh()
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
    Qt.callLater(root.refresh)
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.hostWidget || root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(360))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) {
        if (dx !== 0 && root.demoMode) root.moveDemo(dx)
        if (dy !== 0) root.moveSelection(dy)
      }
      onActivateRequested: root.refresh()
      onTextKey: function(t) {
        if (t === "r" || t === "R") root.refresh()
        else if (t === "f" || t === "F") root.toggleFilters()
        else if (t === "[") root.moveDemo(-1)
        else if (t === "]") root.moveDemo(1)
      }

      Flickable {
        id: scroller
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height

        Column {
          id: content
          width: scroller.width
          spacing: Style.space(10)

          Column {
            width: parent.width
            spacing: Style.space(4)

            Row {
              width: parent.width
              spacing: Style.space(10)

              BrandMark {
                visible: root.alertCount === 0
                anchors.verticalCenter: parent.verticalCenter
                cell: 2
                ink: root.contentForeground
                pip: root.contentAccent
              }

              Text {
                visible: root.alertCount > 0 && root.barIcon !== ""
                text: root.barIcon
                color: root.warningActive ? root.contentUrgent : root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.display
                textFormat: Text.PlainText
              }

              Text {
                width: parent.width - (root.barIcon !== "" ? Style.space(36) : 0)
                text: root.statusHeading()
                color: root.warningActive ? root.contentUrgent : root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.heading
                font.bold: true
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
              }
            }

            Text {
              width: parent.width
              text: root.heroMeta()
              color: root.dim
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
            }
          }

          AlertMap {
            id: footprint
            width: parent.width
            mapHeight: root.mapPixels
            layers: root.mapLayers
            focusRings: root.selected && root.selected.rings ? root.selected.rings : []
            userLat: Number(root.location.latitude)
            userLon: Number(root.location.longitude)
            ink: root.contentForeground
            paper: Color.popups.background
            mark: root.contentAccent
            warning: root.contentUrgent
          }

          Text {
            width: parent.width
            visible: root.selected !== null
            text: {
              var caption = root.selected ? Model.footprintCaption(root.selected.geometryKind) : ""
              if (root.alertCount > 1)
                caption = (caption !== "" ? caption + " · " : "") + "map follows the selected alert"
              return caption
            }
            color: root.dim
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Repeater {
            model: root.alerts

            Rectangle {
              required property var modelData
              required property int index
              width: content.width
              height: rowText.implicitHeight + Style.space(10)
              color: index === root.selectedIndex
                ? Style.selectedFillFor(root.contentForeground, Color.accent)
                : "transparent"
              border.width: 0
              radius: 0

              Rectangle {
                width: Style.space(3)
                height: parent.height
                color: root.severityColor(modelData)
              }

              MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                  root.selectedIndex = index
                  root.selectedId = modelData.id
                }
              }

              Column {
                id: rowText
                anchors.left: parent.left
                anchors.leftMargin: Style.space(12)
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(2)

                Row {
                  width: parent.width
                  spacing: Style.space(8)

                  Text {
                    text: modelData.icon || ""
                    color: root.severityColor(modelData)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.title
                    textFormat: Text.PlainText
                  }

                  Text {
                    width: parent.width - Style.space(28)
                    text: modelData.event
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    font.bold: true
                    elide: Text.ElideRight
                    textFormat: Text.PlainText
                  }
                }

                Text {
                  width: parent.width
                  text: modelData.area
                  color: root.dim
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  elide: Text.ElideRight
                  textFormat: Text.PlainText
                }
              }
            }
          }

          Text {
            width: parent.width
            visible: root.responseLabel() !== ""
            text: root.responseLabel()
            color: root.severityColor(root.selected)
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.body
            font.bold: true
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Text {
            width: parent.width
            visible: root.selected && root.selected.sender !== ""
            text: root.selected ? root.selected.sender : ""
            color: root.dim
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Text {
            width: parent.width
            visible: root.selected && root.selected.instruction !== ""
            text: root.selected ? root.selected.instruction : ""
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Item {
            width: parent.width
            height: filterToggle.implicitHeight
            visible: root.alertCount > 0

            Text {
              id: filterToggle
              width: parent.width
              text: root.filtersOpen
                ? "FILTERS ▾"
                : "FILTERS ▸  " + root.filterSummary()
              color: root.dim
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              textFormat: Text.PlainText
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.toggleFilters()
            }
          }

          Column {
            width: parent.width
            spacing: Style.space(6)
            visible: root.filtersVisible

            Text {
              width: parent.width
              text: "SHOW"
              color: root.dim
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              textFormat: Text.PlainText
            }

            Toggle {
              width: parent.width
              label: "Warnings"
              description: "Default on. Includes warning follow-up statements."
              checked: Model.parseBoolSetting(setting("showWarnings", true), true)
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              onClicked: root.setClass("showWarnings", !Model.parseBoolSetting(setting("showWarnings", true), true))
            }

            Toggle {
              width: parent.width
              label: "Watches"
              description: "Conditions are favorable. Off until you turn them on."
              checked: Model.parseBoolSetting(setting("showWatches", false), false)
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              onClicked: root.setClass("showWatches", !Model.parseBoolSetting(setting("showWatches", false), false))
            }

            Toggle {
              width: parent.width
              label: "Advisories"
              description: "Fog, heat, SPS, and other lower-tier products."
              checked: Model.parseBoolSetting(setting("showAdvisories", false), false)
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              onClicked: root.setClass("showAdvisories", !Model.parseBoolSetting(setting("showAdvisories", false), false))
            }

            Text {
              width: parent.width
              text: "ONLY THESE"
              color: root.dim
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              textFormat: Text.PlainText
            }

            Text {
              width: parent.width
              text: root.filter.families.length === 0
                ? "All products in the classes above. Click to limit."
                : "Limited to the highlighted families."
              color: root.dim
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
            }

            Flow {
              width: parent.width
              spacing: Style.space(6)

              Repeater {
                model: root.familyChoices

                Rectangle {
                  required property var modelData
                  readonly property bool on: root.familySelected(modelData.id)
                  implicitWidth: familyLabel.implicitWidth + Style.space(12)
                  implicitHeight: familyLabel.implicitHeight + Style.space(8)
                  color: on
                    ? Style.selectedFillFor(root.contentForeground, Color.accent)
                    : "transparent"
                  border.width: 1
                  border.color: on ? root.contentAccent : Qt.rgba(root.dim.r, root.dim.g, root.dim.b, 0.45)
                  radius: 0

                  Text {
                    id: familyLabel
                    anchors.centerIn: parent
                    text: modelData.label
                    color: on ? root.contentAccent : root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: on
                    textFormat: Text.PlainText
                  }

                  MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.toggleFamily(modelData.id)
                  }
                }
              }
            }
          }

          Text {
            width: parent.width
            visible: root.selected && root.selected.description !== ""
            text: root.selected ? root.selected.description : ""
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Text {
            width: parent.width
            text: root.footerText()
            color: root.dim
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }
        }
      }
    }
  }
}
