# Acid Alerts visual assets

The repo identity uses the same pixel-diamond A as `BrandMark.qml`: warm white, acid lime, and a deep green-black background. Orange belongs to the warning UI, keeping product severity distinct from the marketing accent.

| Asset | Use |
| --- | --- |
| `../docs/media/hero.png` | README header, 1920 × 960 |
| `../docs/media/social-preview.png` | Ready to upload as the repository's social preview, 1920 × 960 |
| `../docs/media/alert-gallery.png` | Three-panel product gallery, 1920 × 1080 |
| `../preview.png` | Plugin preview, 512 × 512 |
| `mark.png` | Transparent pixel mark, 352 × 352 |
| `source/*.svg` | Editable vector sources with embedded screenshots where needed |

The social-preview file is prepared locally; adding it to the repository does not automatically configure GitHub's social preview.

## Rebuild

From the repository root, with Python 3, `rsvg-convert` (librsvg), and DejaVu Sans / DejaVu Sans Mono fonts installed:

```sh
python scripts/render-branding.py
```

The script reads the pixel pattern directly from `BrandMark.qml`, writes the SVG sources, and renders the PNG exports. It uses the three checked-in panel screenshots as inputs. Edit the generator for durable layout or copy changes; a rebuild overwrites the generated SVGs.

## Screenshot provenance

Screenshots were captured directly from the running plugin on September 18, 2026, on a 1920 × 1080 display at display scale 1. The shell's supported text-size setting was temporarily increased from 10 to 18 for legibility, producing native 540-pixel-wide panels. Normal text size and live alert mode were restored after capture.

| Screenshot | Native size | Mode |
| --- | --- | --- |
| `tornado.png` | 540 × 665 | Demo scene 1 |
| `winter-watch.png` | 540 × 642 | Demo scene 10 |
| `ice-storm.png` | 540 × 642 | Demo scene 11 |
| `no-matching-alerts.png` | 540 × 678 | Live, successful NWS check |
| `bar-idle.png` | 330 × 39 | Live, closed panel |

Only plugin panel or bar regions were captured; unrelated desktop windows are excluded. No UI, alert text, colors, or map shapes were reconstructed or retouched. Complete panel borders and demo footers are retained. Text truncated by the running plugin remains truncated in the images.

The three alert panels show the built-in `Demo.js` gallery centered on Cleveland, Ohio, with Cuyahoga County outlines. Its instruction text and storm polygon are illustrative, not a live NWS product. County / zone outlines use the bundled demo zone atlas. A temporary plugin-only location override selected Cleveland (41.4993, -81.6944); the system weather location was never changed. The no-matching-alerts screenshot records one successful Cleveland check, not a current weather report or a guarantee of safe conditions.

Marketing compositions add headings and a dark background outside the screenshots. Their lime accent is branding, not a claim about the active theme. Header and gallery exports use higher-resolution canvases and preserve the screenshots' native aspect ratios. The obsolete `all-clear.png` has been removed.

## Palette

| Role | Color |
| --- | --- |
| Background | `#0c1110` |
| Surface | `#141c18` |
| Main text / diamond | `#f2f5e9` |
| Secondary text | `#a4b3a8` |
| Accent / letter A | `#c4f568` |

Keep demo labels visible. Avoid claims of instant delivery, guaranteed protection, or official NWS affiliation. The plugin adds weather awareness; it is one of several ways a person should receive weather warnings.
