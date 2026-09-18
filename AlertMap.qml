import QtQuick
import qs.Commons
import "Model.js" as Model

// Pixel footprint of NWS alert polygons. No basemap, no radar, no tiles:
// just the issued shape and a you-are-here mark, snapped to a 3px grid.
Item {
  id: root

  property var layers: []
  property real userLat: NaN
  property real userLon: NaN
  property color ink: Color.foreground
  property color paper: Color.background
  property color mark: Color.accent
  property color warning: Color.urgent
  property int cell: 3
  property int mapHeight: Style.space(128)

  readonly property bool hasFootprint: root.layers && root.layers.length > 0
  readonly property var allRings: collectRings()
  readonly property var bounds: Model.boundsFor(allRings, userLat, userLon, 0.2)

  implicitHeight: hasFootprint ? mapHeight : 0
  visible: hasFootprint && bounds !== null
  clip: true

  onLayersChanged: canvas.requestPaint()
  onUserLatChanged: canvas.requestPaint()
  onUserLonChanged: canvas.requestPaint()
  onInkChanged: canvas.requestPaint()
  onPaperChanged: canvas.requestPaint()
  onMarkChanged: canvas.requestPaint()
  onWarningChanged: canvas.requestPaint()
  onWidthChanged: canvas.requestPaint()
  onHeightChanged: canvas.requestPaint()

  function collectRings() {
    var rings = []
    var list = root.layers || []
    for (var i = 0; i < list.length; i++) {
      var layerRings = list[i] && list[i].rings ? list[i].rings : []
      for (var j = 0; j < layerRings.length; j++) rings.push(layerRings[j])
    }
    return rings
  }

  function fillColor(layer) {
    if (!layer) return root.ink
    if (layer.selected) return layer.rank >= 3 ? root.warning : root.mark
    return root.ink
  }

  Rectangle {
    anchors.fill: parent
    color: root.paper
    border.color: Qt.rgba(root.ink.r, root.ink.g, root.ink.b, 0.22)
    border.width: 1
    radius: 0
  }

  Canvas {
    id: canvas
    anchors.fill: parent
    anchors.margins: 1
    renderTarget: Canvas.FramebufferObject
    renderStrategy: Canvas.Immediate

    onPaint: {
      var ctx = getContext("2d")
      if (!ctx) return
      ctx.reset()
      ctx.fillStyle = root.paper
      ctx.fillRect(0, 0, width, height)
      if (!root.bounds || width < root.cell || height < root.cell) return

      var cell = Math.max(2, root.cell)
      var columns = Math.floor(width / cell)
      var rows = Math.floor(height / cell)
      if (columns < 4 || rows < 4) return

      ctx.fillStyle = Qt.rgba(root.ink.r, root.ink.g, root.ink.b, 0.06)
      for (var gx = 0; gx < columns; gx += 4) {
        ctx.fillRect(gx * cell, 0, 1, rows * cell)
      }
      for (var gy = 0; gy < rows; gy += 4) {
        ctx.fillRect(0, gy * cell, columns * cell, 1)
      }

      var list = root.layers || []
      for (var i = 0; i < list.length; i++) {
        var layer = list[i]
        var cells = Model.rasterCells(layer.rings, root.bounds, columns, rows)
        var color = root.fillColor(layer)
        var alpha = layer.selected ? 0.55 : 0.22
        ctx.fillStyle = Qt.rgba(color.r, color.g, color.b, alpha)
        for (var c = 0; c < cells.length; c++) {
          var index = cells[c]
          var col = index % columns
          var row = Math.floor(index / columns)
          ctx.fillRect(col * cell, row * cell, cell - 1, cell - 1)
        }
        var outline = Model.edgeCells(layer.rings, root.bounds, columns, rows)
        ctx.fillStyle = Qt.rgba(color.r, color.g, color.b, layer.selected ? 0.95 : 0.55)
        for (var e = 0; e < outline.length; e++) {
          var edge = outline[e]
          ctx.fillRect((edge % columns) * cell, Math.floor(edge / columns) * cell, cell - 1, cell - 1)
        }
      }

      if (!isFinite(root.userLat) || !isFinite(root.userLon)) return
      var point = Model.project(root.userLon, root.userLat, root.bounds, columns, rows)
      if (!point) return
      var px = Math.floor(point.x) * cell
      var py = Math.floor(point.y) * cell
      ctx.fillStyle = root.mark
      ctx.fillRect(px - cell, py, cell * 3 - 1, cell - 1)
      ctx.fillRect(px, py - cell, cell - 1, cell * 3 - 1)
    }
  }
}
