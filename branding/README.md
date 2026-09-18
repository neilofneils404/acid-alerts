# Acid Alerts visual assets

The repo identity uses the same pixel-diamond A as `BrandMark.qml`: warm white, acid lime, and a deep green-black background. Orange belongs to the warning UI, keeping product severity distinct from the marketing accent.

| Asset | Use |
| --- | --- |
| `../docs/media/hero.png` | README header, 1280 × 640 |
| `../docs/media/social-preview.png` | Ready to upload as the repository's social preview, 1280 × 640 |
| `../docs/media/alert-gallery.png` | Three-panel product gallery, 1280 × 720 |
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

The tornado, ice storm, and winter watch images are actual plugin screenshots recovered from full desktop captures made September 18, 2026. Only the panel bounds were extracted; no UI, alert text, colors, or map shapes were reconstructed or retouched. The complete panel border and demo footer are retained. Text truncated by the running plugin remains truncated in the images.

All three show the built-in `Demo.js` gallery. Its instruction text and storm polygon are illustrative, not a live NWS product. County / zone outlines use the bundled demo zone atlas. Marketing compositions add headings and a dark background outside those screenshots; their lime accent is branding, not a claim about the screenshot's active theme.

The older `all-clear.png` and `bar-idle.png` remain available but are not featured in the README. The all-clear capture also reports an NWS connection failure, so it is unsuitable as a healthy-state product example.

## Palette

| Role | Color |
| --- | --- |
| Background | `#0c1110` |
| Surface | `#141c18` |
| Main text / diamond | `#f2f5e9` |
| Secondary text | `#a4b3a8` |
| Accent / letter A | `#c4f568` |

Keep demo labels visible. Avoid claims of instant delivery, guaranteed protection, or official NWS affiliation. The plugin adds weather awareness; it is one of several ways a person should receive weather warnings.
