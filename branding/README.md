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

Screenshots were captured directly from the running plugin on September 21, 2026, after reviewing commit `e48cf5b` and applying the follow-up fixes in this working tree. The display was 1920 × 1080 at scale 1.25; the shell font base size was temporarily set to 16. Original shell settings and live mode were restored after capture.

| Screenshot | Native size | Mode |
| --- | --- | --- |
| `tornado.png` | 600 × 852 | Demo scene 1 |
| `winter-watch.png` | 600 × 823 | Demo scene 10 |
| `ice-storm.png` | 600 × 823 | Demo scene 11 |
| `multiple-alerts.png` | 600 × 1005 | Demo scene 19 |
| `no-matching-alerts.png` | 600 × 757 | Live Cleveland check, warnings only |
| `bar-filtered.png` | 125 × 43 | Live Cleveland check, one hidden alert |

Only plugin panel or bar regions were captured; unrelated desktop windows are excluded. No UI, alert text, colors, or map shapes were reconstructed or retouched. Full panel borders and demo labels are retained.

All screenshots use a temporary plugin-only Cleveland override (41.4993, -81.6944); the system weather location was never changed. Demo instructions and storm polygons are illustrative, not live NWS products. County / zone outlines use the bundled atlas: the winter watch covers Cuyahoga and Lorain counties. The multiple-alert screenshot shows the warning selected alongside a watch and advisory.

The live panel and bar record a successful Cleveland check with one product hidden by warning-only filters. They are captured examples, not a current weather report or a guarantee of safe conditions. `bar-filtered.png` replaces the older idle-bar screenshot to illustrate the explicit hidden-alert state.

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
