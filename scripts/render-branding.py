#!/usr/bin/env python3
"""Render repository artwork from SVG; requires Python 3 and rsvg-convert."""
import base64
import re
import subprocess
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'branding/source'
MEDIA = ROOT / 'docs/media'
BG, PANEL, INK, MUTED, LIME = '#0c1110', '#141c18', '#f2f5e9', '#a4b3a8', '#c4f568'
ROWS = re.findall(r'"([.12]{11})"', (ROOT / 'BrandMark.qml').read_text())
assert len(ROWS) == 11, 'Expected the plugin’s 11 × 11 pixel mark'


def text(x, y, value, size=20, fill=INK, weight=400, mono=False):
    family = 'DejaVu Sans Mono, monospace' if mono else 'DejaVu Sans, sans-serif'
    return f'<text x="{x}" y="{y}" fill="{fill}" font-family="{family}" font-size="{size}" font-weight="{weight}">{escape(value)}</text>'


def rect(x, y, w, h, fill, extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" {extra}/>'


def mark(x, y, cell):
    return ''.join(rect(x+i*cell, y+j*cell, cell, cell, LIME if v == '2' else INK)
                   for j, row in enumerate(ROWS) for i, v in enumerate(row) if v != '.')


def screenshot(name, x, y, w, h):
    data = base64.b64encode((MEDIA / name).read_bytes()).decode()
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/png;base64,{data}"/>'


def export(name, width, height, body, target, title):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img"><title>{escape(title)}</title>{body}</svg>'
    source = SOURCE / (name + '.svg')
    source.write_text(svg + '\n')
    subprocess.run(['rsvg-convert', str(source), '-o', str(target)], check=True)


def hero():
    s = rect(0, 0, 1280, 640, BG)
    s += rect(744, 0, 536, 640, PANEL)
    for x in range(768, 1280, 32):
        for y in range(24, 640, 32):
            s += rect(x, y, 2, 2, '#2c3b30')
    s += rect(0, 0, 1280, 5, LIME)
    s += mark(64, 53, 4)
    s += text(128, 81, 'BUILT FOR OMARCHY', 16, LIME, 500, True)
    s += text(60, 213, 'Acid Alerts', 78, INK, 700)
    s += text(64, 285, 'Weather alerts.', 39, INK, 500)
    s += text(64, 335, 'Within reach.', 39, LIME, 500)
    s += text(64, 400, 'National Weather Service alerts,', 23, MUTED)
    s += text(64, 434, 'right in your desktop bar.', 23, MUTED)
    s += rect(64, 503, 600, 1, '#354137')
    s += text(64, 548, 'YOUR LOCATION', 14, LIME, 500, True)
    s += text(287, 548, 'YOUR FILTERS', 14, LIME, 500, True)
    s += text(64, 583, 'Open source. A little more weather awareness.', 17, MUTED)
    s += rect(790, 74, 444, 499, BG, 'rx="12" stroke="#354137"')
    s += rect(814, 99, 8, 8, '#ff8b43')
    s += text(834, 111, 'TORNADO WARNING', 16, INK, 500, True)
    s += rect(814, 131, 396, 1, '#354137')
    s += screenshot('tornado.png', 862, 153, 300, 354)
    s += text(814, 548, 'ACTUAL UI / DEMO DATA', 13, MUTED, 400, True)
    export('hero', 1280, 640, s, MEDIA / 'hero.png', 'Acid Alerts — weather alerts within reach. Actual Omarchy plugin UI with demo data.')
    # A separate filename makes the intended GitHub social upload explicit.
    (MEDIA / 'social-preview.png').write_bytes((MEDIA / 'hero.png').read_bytes())


def gallery():
    s = rect(0, 0, 1280, 720, BG)
    s += text(48, 60, 'One place to see what’s in force.', 34, INK, 700)
    s += text(48, 98, 'Alert type, affected area, and instructions — a click from your bar.', 20, MUTED)
    cards = [
        ('01', 'Tornado warning', 'Storm-based polygon', 'tornado.png', 354),
        ('02', 'Ice storm warning', 'County / zone outline', 'ice-storm.png', 342),
        ('03', 'Winter storm watch', 'County / zone outline', 'winter-watch.png', 342),
    ]
    for i, (n, title, caption, filename, height) in enumerate(cards):
        x = 48 + 400*i
        s += rect(x, 139, 384, 500, PANEL, 'rx="10" stroke="#354137"')
        s += text(x+24, 174, n, 14, LIME, 500, True)
        s += text(x+24, 208, title, 23, INK, 700)
        s += screenshot(filename, x+42, 234, 300, height)
        s += text(x+24, 617, caption, 15, MUTED, 400, True)
    s += text(48, 682, 'DEMO GALLERY', 14, LIME, 500, True)
    s += text(240, 682, 'Illustrative scenarios, not live alerts. Appearance follows your Omarchy theme.', 16, MUTED)
    export('alert-gallery', 1280, 720, s, MEDIA / 'alert-gallery.png', 'Three actual Acid Alerts panels showing demo tornado, ice storm, and winter watch scenarios.')


def icon():
    s = rect(0, 0, 512, 512, BG)
    s += rect(32, 32, 448, 448, PANEL, 'rx="32" stroke="#354137" stroke-width="2"')
    s += mark(102, 102, 28)
    export('icon', 512, 512, s, ROOT / 'preview.png', 'Acid Alerts pixel diamond mark')
    export('mark', 352, 352, mark(0, 0, 32), ROOT / 'branding/mark.png', 'Acid Alerts pixel diamond mark on a transparent background')


if __name__ == '__main__':
    SOURCE.mkdir(parents=True, exist_ok=True)
    hero()
    gallery()
    icon()
    print('Rendered hero, social preview, gallery, plugin preview, and transparent mark.')
