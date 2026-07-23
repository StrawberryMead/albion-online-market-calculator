# Moonlit Lily

Static Albion Online market calculator with a moonlit graveyard + white lily aesthetic.
Hosts on GitHub Pages. No backend, no build step.

## Features

- **Equipment / Potions / Foods** crafting calculators. Batch size is read from
  `craftingrequirements.@amountcrafted` (potions and foods produce 5 per craft, equipment 1).
- **Bonuses**: Premium (fee -50%), Focus, and city specialty return-rate bonus.
- **Prices** tab: live buy/sell across cities via the Albion Online Data Project.
- **Settings** tab: server (America / Europe / Asia), language, market tax, cache TTL.

## Setup

```bash
git clone <this-repo>
cd market-calculator
git submodule update --init --depth 1 ao-bin-dumps    # optional but recommended
python3 -m http.server 8080                            # or any static server
# open http://localhost:8080
```

Without the submodule the app falls back to `data/seed-items.json` so you can still verify the
UI end-to-end.

## Deploy to GitHub Pages

The included workflow `.github/workflows/update-data.yml` refreshes the submodule weekly and
publishes the repo root via `actions/deploy-pages@v4`. Enable Pages -> "GitHub Actions" as the
source and the first `workflow_dispatch` run will deploy the site.

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/data-model.md`](docs/data-model.md)
- [`docs/ui.md`](docs/ui.md)
- [`docs/api.md`](docs/api.md)

Not affiliated with, endorsed, sponsored, or specifically approved by Sandbox Interactive.
