import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

BarWidget {
  id: root
  moduleName: "neil.acid-alerts"

  // The shell hosts Service.qml once for every monitor's bar. A bar that
  // cannot hand it over (a replacement bar) gets a private copy instead.
  property var sharedService: null
  property int serviceAttempts: 0
  readonly property bool serviceMissing: sharedService === null && serviceAttempts >= 10
  readonly property var service: sharedService || localService.item || null

  readonly property bool opened: panelLoader.item
    ? panelLoader.item.opened === true
    : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false
  readonly property int alertCount: service ? service.alertCount : 0
  readonly property string label: {
    if (!service) return ""
    var text = Model.barLabel(service.alerts, root.vertical)
    if (service.demoMode && text !== "") return "DEMO" + (root.vertical ? " " : " · ") + text
    return text
  }
  readonly property string barIcon: service ? service.barIcon : ""
  readonly property string tooltip: service ? service.barTooltip : "Acid Alerts"
  readonly property bool warningActive: service ? service.warningActive : false
  readonly property bool hasAlerts: alertCount > 0
  readonly property string barMood: service ? service.barMood : "checking"
  readonly property string idleLabel: service ? service.barText : ""
  readonly property bool showState: !hasAlerts && idleLabel !== ""
  readonly property bool hideWhenClear: Model.parseBoolSetting(setting("hideWhenClear", false), false)
  // Side bars have room for symbols and counts, not event names.
  readonly property var verticalAlertLabels: {
    var rows = [root.barIcon || "!"]
    if (root.alertCount > 1) rows.push(String(root.alertCount))
    if (root.barMood === "demo") rows.push("DEMO")
    return rows
  }
  readonly property var verticalStateLabels: {
    if (root.barMood === "unavailable") return ["!"]
    if (root.barMood === "setup") return ["?"]
    if (root.barMood === "filtered") return ["", root.idleLabel.split(" ")[0]]
    if (root.barMood === "demo") return ["DEMO"]
    return []
  }
  readonly property var anchorButton: hasAlerts ? alertButton : (showState ? stateButton : idleButton)

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function refresh() {
    if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
  }

  function resolveService() {
    var shell = root.bar ? root.bar.shell : null
    var found = shell && typeof shell.serviceFor === "function" ? shell.serviceFor(root.moduleName) : null
    if (found) {
      root.sharedService = found
      root.serviceAttempts = 0
    } else {
      root.serviceAttempts += 1
    }
  }

  function configureService() {
    if (root.service && root.bar) root.service.configure(root.settings)
  }

  function syncPanel() {
    if (!root.service) {
      panelLoader.source = ""
      return
    }
    if (panelLoader.item) {
      panelLoader.item.service = root.service
      return
    }
    panelLoader.setSource(Qt.resolvedUrl("Panel.qml"), { service: root.service })
  }

  function injectPanel() {
    if (!panelLoader.item) return
    panelLoader.item.bar = root.bar
    panelLoader.item.settings = root.settings
    panelLoader.item.anchorItem = root.anchorButton
    panelLoader.item.hostWidget = root
  }

  visible: !hideWhenClear || barMood !== "clear"
  implicitWidth: hasAlerts ? alertButton.implicitWidth : (showState ? stateButton.implicitWidth : idleButton.implicitWidth)
  implicitHeight: hasAlerts ? alertButton.implicitHeight : (showState ? stateButton.implicitHeight : idleButton.implicitHeight)

  // The bar injects `bar` and then `settings` in one pass. Look up the service
  // after that pass so it is never configured with the empty default settings.
  onBarChanged: {
    if (!root.sharedService) Qt.callLater(root.resolveService)
    injectPanel()
  }
  onSettingsChanged: {
    configureService()
    injectPanel()
  }
  onServiceChanged: {
    configureService()
    syncPanel()
  }
  onHasAlertsChanged: injectPanel()
  onShowStateChanged: injectPanel()

  // The shell may create the service after this widget. Keep asking briefly.
  Timer {
    interval: 500
    repeat: true
    running: root.sharedService === null && root.serviceAttempts < 10
    onTriggered: root.resolveService()
  }

  Loader {
    id: localService
    active: root.serviceMissing
    source: Qt.resolvedUrl("Service.qml")
  }

  Loader {
    id: panelLoader
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  Component {
    id: brandComp
    BrandMark {
      ink: Color.foreground
      pip: Color.accent
    }
  }

  BarIconButton {
    id: idleButton
    visible: !root.hasAlerts && !root.showState
    bar: root.bar
    slotSize: Style.bar.statusSlot
    tooltipText: root.tooltip
    iconComponent: brandComp

    onPressed: function(buttonCode) {
      if (buttonCode === Qt.MiddleButton) root.refresh()
      else if (buttonCode === Qt.LeftButton) root.toggle()
    }
  }

  WidgetButton {
    id: stateButton
    visible: root.showState
    bar: root.bar
    text: root.vertical ? "" : root.idleLabel
    tooltipText: root.tooltip
    active: root.barMood === "unavailable"
    useActiveColor: root.barMood === "unavailable"
    labelVisible: !root.vertical
    hasVisualContent: root.showState
    horizontalMargin: 8.75
    verticalPadding: 8.75

    onPressed: function(buttonCode) {
      if (buttonCode === Qt.MiddleButton) root.refresh()
      else if (buttonCode === Qt.LeftButton) root.toggle()
    }

    fixedHeight: root.vertical ? stateColumn.implicitHeight : -1

    Column {
      id: stateColumn
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: root.verticalStateLabels

        Text {
          required property string modelData
          width: stateButton.width
          height: Style.bar.iconSlot
          text: modelData
          textFormat: Text.PlainText
          fontSizeMode: Text.HorizontalFit
          minimumPixelSize: 6
          horizontalAlignment: Text.AlignHCenter
          verticalAlignment: Text.AlignVCenter
          font.family: stateButton.fontFamily
          font.pixelSize: modelData === "DEMO" ? Style.font.caption : Style.bar.iconFont
          color: stateButton.active ? stateButton.activeColor : stateButton.foreground
        }
      }
    }
  }

  WidgetButton {
    id: alertButton
    visible: root.hasAlerts
    bar: root.bar
    text: root.vertical ? "" : (root.barIcon !== "" ? root.barIcon + "  " + root.label : root.label)
    tooltipText: root.tooltip
    active: root.warningActive
    useActiveColor: root.warningActive
    labelVisible: !root.vertical
    hasVisualContent: root.hasAlerts
    horizontalMargin: 8.75
    verticalPadding: 8.75

    onPressed: function(buttonCode) {
      if (buttonCode === Qt.MiddleButton) root.refresh()
      else if (buttonCode === Qt.LeftButton) root.toggle()
    }

    fixedHeight: root.vertical ? alertColumn.implicitHeight : -1

    Column {
      id: alertColumn
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: root.verticalAlertLabels

        Text {
          required property string modelData
          width: alertButton.width
          height: Style.bar.iconSlot
          text: modelData
          textFormat: Text.PlainText
          fontSizeMode: Text.HorizontalFit
          minimumPixelSize: 6
          horizontalAlignment: Text.AlignHCenter
          verticalAlignment: Text.AlignVCenter
          font.family: alertButton.fontFamily
          font.pixelSize: modelData === root.barIcon ? Style.bar.iconFont : Style.font.caption
          color: alertButton.active ? alertButton.activeColor : alertButton.foreground
        }
      }
    }
  }
}
