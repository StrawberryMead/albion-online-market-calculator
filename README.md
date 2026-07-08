# Albion Online Market Calculator

A static, no-build web app that helps you look up market prices, evaluate crafting/refining
profit, and find city-to-city flip opportunities in Albion Online. Hosts on GitHub Pages.

- Live market data: [Albion Online Data Project](https://www.albion-online-data.com/api/)
- Item catalog: [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps/blob/master/formatted/items.json)

## Features

- **Prices** tab — search by item name, choose qualities, view current buy/sell across cities and a 24h/7d/30d chart (hourly, 6h, or daily scale)
- **Crafting** tab — pick a craftable item, auto-load a recipe, adjust return rate + focus + crafting fee, see instant and patient profit
- **Refining** tab — pick refined output, auto-suggest raw + previous-tier refined materials, compute profit with city return rates
- **Transport** tab — pick an item, see best city-pair flips sorted by margin, factoring in market tax
- **Settings** tab — server (West/East/Europe), item-name language, cache TTL, return-rate defaults, and a **Update from ao-bin-dumps** button that refreshes the item database in-browser (stored in IndexedDB)

## Development

```bash
# Serve locally
npm run serve        # http://localhost:8080
# or:
python3 -m http.server 8080

# Rebuild data/items.min.json from ao-bin-dumps (requires internet)
npm run build:items
```

## Deploy on GitHub Pages

1. Push to `master` (or `main`).
2. In the repo's Settings → Pages, set the source to `master` / root.
3. Wait a minute; the site will be live at `https://<user>.github.io/<repo>/`.

No backend, no build step, no framework. Just static files.

## File layout

```
index.html                    Shell + tab nav
css/main.css                  Albion dark theme
css/components.css            Tables, chips, chart, toasts
data/items.min.json           Minified item index (starter set; refresh in Settings)
data/recipes.min.json         Seed recipes (extend as needed)
data/stations.json            City + quality metadata
js/app.js                     Bootstrap + hash router
js/api.js                     AODP client (prices + history)
js/items.js                   Item index + IndexedDB overlay
js/settings.js                Persistent settings
js/utils/                     dom, fmt, debounce, chart
js/tabs/                      prices, crafting, refining, transport, settings
scripts/build-items.mjs       Offline builder for items.min.json
```

Not affiliated with, endorsed, sponsored, or specifically approved by Sandbox Interactive.
