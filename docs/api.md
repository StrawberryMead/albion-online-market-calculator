# API integration

## Albion Online Data Project (AODP)

Base URL is chosen from `Settings.server`:

| Server key | Region      | Host                                    |
|------------|-------------|-----------------------------------------|
| `america`  | West/NA     | `west.albion-online-data.com`           |
| `europe`   | Europe      | `europe.albion-online-data.com`         |
| `asia`     | East/Asia   | `east.albion-online-data.com`           |

All endpoints live under `/api/v2/stats/`.

### Prices

```
GET https://<host>/api/v2/stats/prices/<comma-item-ids>?locations=<comma-cities>&qualities=<1..5>
```

Example:

```
GET https://west.albion-online-data.com/api/v2/stats/prices/T4_MAIN_SWORD?locations=Caerleon,Martlock&qualities=1
```

Response is an array of rows:

```json
[
  {
    "item_id": "T4_MAIN_SWORD",
    "city": "Caerleon",
    "quality": 1,
    "sell_price_min": 4200,
    "sell_price_min_date": "2026-07-22T18:12:00",
    "sell_price_max": 5800,
    "sell_price_max_date": "2026-07-22T18:12:00",
    "buy_price_max": 3900,
    "buy_price_max_date": "2026-07-22T18:11:00",
    "buy_price_min": 100,
    "buy_price_min_date": "2026-07-22T15:00:00"
  }
]
```

### History (used by Prices tab charts)

```
GET https://<host>/api/v2/stats/history/<item-id>?locations=<city>&qualities=<q>&time-scale=<24|6|1>
```

## Client (`js/api.js`)

- `fetchPrices(itemIds, { locations, qualities })` chunks large id lists into groups of 60.
- `fetchHistory(itemId, { location, quality, timeScale })` returns raw AODP history rows.
- Every response is stored in an in-memory `Map` with `Settings.cacheTtlMinutes * 60_000` TTL.
- `pickCitySellPrice` / `pickCityBuyPrice` pick the practical reference price for a given
  city + quality (ignoring 0 values which mean "no data").
- `clearPriceCache()` is exposed to the Settings tab.

## Item catalog (`js/data-loader.js`)

- Primary path: `fetch("ao-bin-dumps/formatted/items.json")` with `cache: "force-cache"`.
- Fallback path: `fetch("data/seed-items.json")`.
- Each record is normalized to `{ id, category, subCategory, tier, batchSize, craftingFee,
  materials, ... }`. **`batchSize` is read from `craftingrequirements.@amountcrafted`.**

## Rate limiting

AODP is a volunteer service. The client:

- Chunks requests (max 60 ids per call).
- Caches responses (default 15 min).
- Only fetches when the user clicks "Fetch Market" or activates the Prices tab.

## Error handling

- HTTP failures throw an `Error` and surface as a toast in the UI.
- If AODP is unreachable, manual price entry still works for all recipe calculations.
- If `ao-bin-dumps` is missing at runtime, the loader silently falls back to seed data and
  logs a `console.warn`.
