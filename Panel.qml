import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Presentation only. Alert state, polling, and notifications belong to the
// shared Service.qml, so every monitor's panel shows the same check.
Panel {
  id: root
  moduleName: "neil.acid-alerts"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var service: null
  property bool filtersOpen: false

  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property color contentUrgent: bar ? bar.urgent : Color.urgent
  readonly property color contentAccent: Color.accent
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color dim: Qt.darker(contentForeground, 1.55)
  readonly property int alertCount: service ? service.alertCount : 0
  readonly property var familyChoices: Model.familyOptions()
  readonly property bool filtersVisible: alertCount === 0 || filtersOpen
  readonly property int mapPixels: {
    var avail = panel.availableCardHeight
    if (avail > 0 && avail < 400) return Style.space(88)
    if (avail > 0 && avail < 560) return Style.space(108)
    return Style.space(128)
  }

  function open() {
    root.controller.show()
    if (root.service) {
      root.service.reloadLocation()
      root.service.refresh()
    }
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

  function refresh() {
    if (root.service) root.service.refresh()
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

  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]
    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    else if (root.service) root.service.configure(entry)
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function setClass(key, value) {
    var patch = {}
    patch[key] = value
    root.persistSettings(patch)
  }

  function toggleFamily(id) {
    var current = (root.service.filter.families || []).slice()
    var at = current.indexOf(id)
    if (at === -1) current.push(id)
    else current.splice(at, 1)
    root.persistSettings({ families: current })
  }

  function familySelected(id) {
    var list = root.service.filter.families || []
    return list.indexOf(id) !== -1
  }

  function toggleFilters() {
    root.filtersOpen = !root.filtersOpen
  }

  function filterSummary() {
    var filter = root.service.filter
    var parts = []
    if (filter.warnings) parts.push("Warnings")
    if (filter.watches) parts.push("Watches")
    if (filter.advisories) parts.push("Advisories")
    if (filter.families.length > 0) parts.push(String(filter.families.length) + " families")
    if (parts.length === 0) return "nothing selected"
    return parts.join(" · ")
  }

  function severityColor(alert) {
    if (!alert) return root.dim
    if (Model.eventClass(alert.event) === "warning" || alert.rank >= 3) return root.contentUrgent
    if (Model.eventClass(alert.event) === "watch" || alert.rank >= 2) return root.contentAccent
    return root.dim
  }

  onAlertCountChanged: if (root.alertCount > 0) root.filtersOpen = false

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
        if (dx !== 0 && root.service.demoMode) root.service.moveDemo(dx)
        if (dy !== 0) root.service.moveSelection(dy)
      }
      onActivateRequested: root.service.refresh()
      onTextKey: function(t) {
        if (t === "r" || t === "R") root.service.refresh()
        else if (t === "f" || t === "F") root.toggleFilters()
        else if (t === "[") root.service.moveDemo(-1)
        else if (t === "]") root.service.moveDemo(1)
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
                id: headingMark
                visible: root.service.alertCount === 0
                anchors.verticalCenter: parent.verticalCenter
                cell: 2
                ink: root.contentForeground
                pip: root.contentAccent
              }

              Text {
                id: headingIcon
                visible: root.service.alertCount > 0 && root.service.selectedIcon !== ""
                text: root.service.selectedIcon
                color: root.service.selectedUrgent ? root.contentUrgent : root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.display
                textFormat: Text.PlainText
              }

              Text {
                width: parent.width - parent.spacing - (headingMark.visible ? headingMark.width : headingIcon.implicitWidth)
                text: root.service.statusHeading()
                color: root.service.selectedUrgent ? root.contentUrgent : root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.heading
                font.bold: true
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
              }
            }

            Text {
              width: parent.width
              text: root.service.heroMeta()
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
            layers: root.service.mapLayers
            focusRings: root.service.selected && root.service.selected.rings ? root.service.selected.rings : []
            userLat: Number(root.service.location.latitude)
            userLon: Number(root.service.location.longitude)
            ink: root.contentForeground
            paper: Color.popups.background
            mark: root.contentAccent
            warning: root.contentUrgent
          }

          Text {
            width: parent.width
            visible: root.service.selected !== null
            text: {
              var caption = root.service.selected ? Model.footprintCaption(root.service.selected.geometryKind) : ""
              if (root.service.alertCount > 1)
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
            model: root.service.alerts

            Rectangle {
              required property var modelData
              required property int index
              width: content.width
              height: rowText.implicitHeight + Style.space(10)
              color: index === root.service.selectedIndex
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
                onClicked: root.service.selectIndex(index)
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
            visible: root.service.responseLabel() !== ""
            text: root.service.responseLabel()
            color: root.severityColor(root.service.selected)
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.body
            font.bold: true
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Text {
            width: parent.width
            visible: root.service.selected && root.service.selected.sender !== ""
            text: root.service.selected ? root.service.selected.sender : ""
            color: root.dim
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Text {
            width: parent.width
            visible: root.service.selected && root.service.selected.instruction !== ""
            text: root.service.selected ? root.service.selected.instruction : ""
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Item {
            width: parent.width
            height: filterToggle.implicitHeight
            visible: root.service.alertCount > 0

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
              description: "Default on. Includes follow-up statements and civil emergencies."
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
              text: root.service.filter.families.length === 0
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
            visible: root.service.selected && root.service.selected.description !== ""
            text: root.service.selected ? root.service.selected.description : ""
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
          }

          Text {
            width: parent.width
            text: root.service.footerText()
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
