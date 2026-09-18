import QtQuick
import qs.Commons

// Pixel diamond with a geometric A. Idle brand for the bar and empty panel.
// Colors come from the active Omarchy theme: outline in `ink`, letter in `pip`.
Item {
  id: root

  property color ink: Color.foreground
  property color pip: Color.accent
  property int cell: 0

  // 1 = diamond, 2 = A. The A is a two-pixel peak and a full crossbar so it
  // still reads at 11px on the bar.
  readonly property var rows: [
    ".....1.....",
    "....1.1....",
    "...1...1...",
    "..1.2.2.1..",
    ".1.2...2.1.",
    "1.2.222.2.1",
    ".1.2...2.1.",
    "..1.2.2.1..",
    "...1...1...",
    "....1.1....",
    ".....1....."
  ]

  readonly property int grid: rows.length
  readonly property int resolvedCell: {
    if (cell > 0) return cell
    var side = Math.min(width, height)
    return Math.max(1, Math.floor(side / grid))
  }

  implicitWidth: cell > 0 ? grid * cell : grid
  implicitHeight: cell > 0 ? grid * cell : grid

  onInkChanged: canvas.requestPaint()
  onPipChanged: canvas.requestPaint()
  onCellChanged: canvas.requestPaint()
  onResolvedCellChanged: canvas.requestPaint()
  onWidthChanged: canvas.requestPaint()
  onHeightChanged: canvas.requestPaint()

  Canvas {
    id: canvas
    anchors.fill: parent
    renderTarget: Canvas.FramebufferObject
    renderStrategy: Canvas.Immediate

    onPaint: {
      var ctx = getContext("2d")
      if (!ctx) return
      ctx.reset()
      var cell = root.resolvedCell
      var grid = root.rows
      var ox = Math.floor((width - grid[0].length * cell) / 2)
      var oy = Math.floor((height - grid.length * cell) / 2)
      for (var y = 0; y < grid.length; y++) {
        var line = grid[y]
        for (var x = 0; x < line.length; x++) {
          var ch = line.charAt(x)
          if (ch === ".") continue
          ctx.fillStyle = ch === "2" ? root.pip : root.ink
          ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell)
        }
      }
    }
  }
}
