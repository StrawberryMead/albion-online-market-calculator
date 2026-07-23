# Data model

## Sources

- `ao-bin-dumps/formatted/items.json` - full item catalog with `craftingrequirements`.
- `data/seed-items.json` - trimmed fallback used when the submodule is absent.
- AODP `/api/v2/stats/prices/<ids>?locations=<cities>&qualities=<q>` - live market prices.

## Item record

Normalized in `js/data-loader.js`:

```js
{
  id: "T4_MAIN_SWORD",     // ao-bin-dumps @uniquename
  family: "weapon",         // raw ao-bin-dumps group
  category: "equipment",    // one of equipment | potions | foods | other
  subCategory: "plate",     // used for city specialty matching
  tier: 4,                  // parsed from Tn_ prefix
  enchant: 0,               // parsed from @n suffix
  name: "Main Sword",       // humanized id
  batchSize: 1,             // <-- CRITICAL: from craftingrequirements.@amountcrafted
  craftingFee: 480,         // silver per craft (from @silver)
  focusCost: 36,            // focus per craft (from @craftingfocus)
  materials: [
    { id: "T4_METALBAR", qty: 16 },
    { id: "T3_PLANKS",   qty: 8  }
  ],
  raw: <original ao-bin-dumps record>
}
```

### Batch size per category

| Category  | Typical batchSize | Source                                     |
|-----------|-------------------|--------------------------------------------|
| Equipment | 1                 | `craftingrequirements.@amountcrafted = 1`  |
| Potions   | 5                 | `craftingrequirements.@amountcrafted = 5`  |
| Foods     | 5                 | `craftingrequirements.@amountcrafted = 5`  |

The engine never assumes 1; it reads the actual value.

## Recipe view (runtime)

Built by `craft-engine.buildRecipeView`:

```js
{
  item: <Item>,
  batchSize: 5,
  craftingFee: 120,
  materials: [
    { id, qty, name, tier, price, priceSource: "manual" | "market", priceUpdated }
  ],
  sellPrice: 0,
  sellPriceSource: "manual",
  sellPriceUpdated: null
}
```

## Bonus math

Constants in `bonus-calculator.js`:

- `BASE_RRR = 0.152` - default non-focus city return rate.
- `FOCUS_BASE_RRR = 0.4785` - focus return rate.
- `PREMIUM_FEE_DISCOUNT = 0.5` - premium halves the crafting fee.

City specialty table (`CITY_BONUS`) maps categories or sub-categories to an additive bonus
(e.g. `Fort Sterling.cloth = 0.20`). When `useCraftingBonus` is enabled and the item matches,
the bonus is added to the base RRR (capped at 0.9).

### Effective output (batch-aware)

Returned materials feed back into more crafts. With RRR `r` and batch size `b`, the expected
total output per starting material set is:

```
outputPerCraft = b * (1 / (1 - r))
```

Examples:

- Equipment (b=1) with non-focus city (r=0.152): 1 * 1.179 = 1.179 items per craft.
- Potion (b=5) with focus (r=0.4785): 5 * 1.918 = 9.59 potions per craft.
- Food (b=5) at Lymhurst with omelette specialty + focus (r=0.6785): 5 * 3.112 = 15.56 meals.

### Profit

```
materialCost = sum(qty * unitPrice)
fee          = premium ? craftingFee * 0.5 : craftingFee
totalCost    = materialCost + fee
revenue      = outputPerCraft * sellPrice * (1 - marketTax)
profitPerCraft = revenue - totalCost
profitPerUnit  = profitPerCraft / outputPerCraft
breakEvenSell  = totalCost / (outputPerCraft * (1 - marketTax))
```

Market tax defaults: `premium = 0.04`, `non-premium = 0.08`.
