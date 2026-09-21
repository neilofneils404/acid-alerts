import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "neil.acid-alerts"

  readonly property bool opened: panelLoader.item
    ? panelLoader.item.opened === true
    : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false
  readonly property int alertCount: panelLoader.item ? panelLoader.item.alertCount : 0
  readonly property string label: panelLoader.item ? panelLoader.item.label : ""
  readonly property string barIcon: panelLoader.item ? panelLoader.item.barIcon : ""
  readonly property string tooltip: panelLoader.item ? panelLoader.item.barTooltip : "Acid Alerts"
  readonly property bool warningActive: panelLoader.item ? panelLoader.item.warningActive : false
  readonly property bool hasAlerts: alertCount > 0
  readonly property string barMood: panelLoader.item ? panelLoader.item.barMood : "checking"
  readonly property string idleLabel: panelLoader.item ? panelLoader.item.barText : ""
  readonly property bool showState: !hasAlerts && idleLabel !== ""
  readonly property bool hideWhenClear: {
    var value = root.settings ? root.settings.hideWhenClear : false
    return value === true || value === 1 || value === "true" || value === "1" || value === "yes"
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

  function injectPanel() {
    if (!panelLoader.item) return
    panelLoader.item.bar = root.bar
    panelLoader.item.settings = root.settings
    panelLoader.item.anchorItem = root.anchorButton
    panelLoader.item.hostWidget = root
  }

  visible: !hideWhenClear || (barMood !== "clear" && barMood !== "checking")
  implicitWidth: hasAlerts ? alertButton.implicitWidth : (showState ? stateButton.implicitWidth : idleButton.implicitWidth)
  implicitHeight: hasAlerts ? alertButton.implicitHeight : (showState ? stateButton.implicitHeight : idleButton.implicitHeight)

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onHasAlertsChanged: injectPanel()
  onShowStateChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
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

    Column {
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: root.idleLabel === "" ? [] : root.idleLabel.split(" ")

        OpticalGlyph {
          required property string modelData
          width: stateButton.width
          height: Style.bar.iconSlot
          text: modelData
          fontFamily: stateButton.fontFamily
          fontSize: modelData.length > 4 ? stateButton.fontSize * 0.9 : stateButton.fontSize
          color: stateButton.foreground
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

    Column {
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: (root.barIcon !== "" ? [root.barIcon] : []).concat(root.label.split(" "))

        OpticalGlyph {
          required property string modelData
          width: alertButton.width
          height: Style.bar.iconSlot
          text: modelData
          fontFamily: alertButton.fontFamily
          fontSize: modelData.length > 4 ? alertButton.fontSize * 0.9 : alertButton.fontSize
          color: alertButton.foreground
        }
      }
    }
  }
}
