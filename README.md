# Acid Alerts

National Weather Service alerts in the Omarchy bar. A small diamond mark sits next to the clock; when a warning is in force it becomes the event pill.

This is not a forecast, not radar, and not a replacement for Wireless Emergency Alerts or NOAA Weather Radio.

## Install

```sh
omarchy plugin add https://github.com/neilofneils404/acid-alerts.git --enable
```

The plugin reads the same location file Omarchy weather already uses:

```
~/.local/state/omarchy/settings/weather.json
```

Set it without turning the weather pill on:

```sh
omarchy-weather-location --set "Grafton" 41.27255,-82.05459
```

Coverage is the United States and its territories, because that is what [api.weather.gov](https://www.weather.gov/documentation/services-web-api) issues. Outside that area the bar stays quiet.

## Usage

The bar always shows the Acid Alerts mark. When a matching product is in force, the mark becomes the event pill. Click for the issued text, the instruction, and — when NWS included a shape — a pixel footprint with a you-are-here mark.

**Default: all warnings.** Watches and advisories stay off until you enable them in the panel. Click a family chip (Tornado, Winter / ice, …) to limit further; click it again to return to every product in the enabled classes. A tornado-only install is: Warnings on, everything else off, Tornado highlighted.

- Left click opens or closes the panel
- Middle click refreshes
- Escape closes
- `r` refreshes while the panel is focused
- Up / Down moves between stacked alerts

Desktop notifications fire for new warnings, and for later-arriving immediate moderate alerts. Advisories already in force when the shell starts do not toast.

## Configure

```sh
omarchy bar move neil.acid-alerts --section center
```

Optional per-widget settings in `~/.config/omarchy/shell.json`:

| Key | Meaning |
| --- | --- |
| `refreshSeconds` | Poll interval. Default `60`, minimum `30`. |
| `showWarnings` | Show Warning products. Default `true`. |
| `showWatches` | Show Watch products. Default `false`. |
| `showAdvisories` | Show advisories, statements, and similar. Default `false`. |
| `families` | Optional allow-list: `tornado`, `thunderstorm`, `flashflood`, `flood`, `winter`, `wind`, `cold`, `heat`, `fire`, `tropical`, `fog`, `other`. Empty means every family. |
| `latitude` / `longitude` | Override the weather location for this widget only. |
| `name` | Label used with a coordinate override. |

The plugin never writes the Omarchy weather location file.

To walk a gallery of product types without waiting on weather (tornado, flash flood, winter storm, ice, blizzard, and the rest), set `"demo": true` on the widget entry. `[` and `]` move between scenes. Demo watches and winter products use the real Lorain / Cuyahoga / Medina outlines from NWS; storm-based demos use typical warning-polygon shapes, not a live issuance. The footer says DEMO. Remove `demo` before publishing or daily use.

## Remove

```sh
omarchy plugin remove neil.acid-alerts
```

## Data

Active alerts come from `https://api.weather.gov/alerts/active?point={lat},{lon}`. Point queries resolve both zone-based watches and county or polygon warnings for that coordinate.

The pixel map draws official NWS geometry only:

- **Storm-based warnings** (tornado, severe thunderstorm, flash flood, snow squall) use the polygon the Weather Forecast Office issued with the product.
- **Zone and county products** (winter storms, ice, watches, many advisories) often ship with no polygon. The plugin then loads the county or forecast-zone outline from `api.weather.gov/zones/...` via `affectedZones` / UGC codes.

It does not invent county lines, and it is not a basemap or radar. If NWS did not publish a shape, the map stays empty and the caption says so.

Requests send a identifying `User-Agent` as NWS requires. No API key.

## Safety

Acid Alerts is a desktop glance at official NWS products. It can miss an issue, a poll, or a network blip. For life-threatening weather, use NOAA Weather Radio, Wireless Emergency Alerts, and local instructions.

## License

MIT. Alert text and polygons are U.S. Government public-domain NWS data.
