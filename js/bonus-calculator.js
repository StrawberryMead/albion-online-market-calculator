/*
 * bonus-calculator.js
 * Batch-aware Albion Online return-rate + profit math.
 */

export const CITY_BONUS = {
  Bridgewatch:   { plate: 0.20, cook_stew: 0.20, potion_fear: 0.20, block: 0.20 },
  Caerleon:      { all: 0.10 },
  "Fort Sterling": { cloth: 0.20, plate: 0.10, cook_pie: 0.20, potion_invis: 0.20 },
  Lymhurst:      { leather: 0.20, cook_omelette: 0.20, potion_poison: 0.20 },
  Martlock:      { hide_focus: 0.20, cook_sandwich: 0.20, potion_healing: 0.20 },
  Thetford:      { cloth: 0.20, leather: 0.10, cook_soup: 0.20, potion_gigantify: 0.20 },
  Brecilien:     { all: 0.05 }
};

export const CITIES = Object.keys(CITY_BONUS);

const BASE_RRR = 0.152;
const FOCUS_BASE_RRR = 0.4785;
const PREMIUM_FEE_DISCOUNT = 0.5;

export function estimateRRR({ city, category = "generic", subCategory = "", focus = false, useCraftingBonus = true }) {
  const bonus = useCraftingBonus ? matchCityBonus(city, category, subCategory) : 0;
  const base = focus ? FOCUS_BASE_RRR : BASE_RRR;
  return Math.min(0.9, base + bonus);
}

function matchCityBonus(city, category, subCategory) {
  const table = CITY_BONUS[city] || {};
  if (table.all != null) return table.all;
  const keys = [subCategory, category].filter(Boolean).map((k) => String(k).toLowerCase());
  for (const key of keys) {
    if (table[key] != null) return table[key];
  }
  return 0;
}

/*
 * Batch-aware effective output.
 * When RRR = r, expected total crafts per set of materials = 1 / (1 - r)
 * Multiply by the recipe batch size (amountcrafted).
 */
export function effectiveOutput(batchSize, rrr) {
  const r = Math.max(0, Math.min(0.95, rrr));
  const multiplier = 1 / (1 - r);
  return batchSize * multiplier;
}

export function computeProfit({
  materials,
  batchSize = 1,
  sellPrice = 0,
  craftingFeePerCraft = 0,
  rrr = BASE_RRR,
  marketTax = 0.08,
  premium = false
}) {
  const materialCostPerCraft = materials.reduce(
    (sum, m) => sum + (Number(m.qty) || 0) * (Number(m.price) || 0),
    0
  );
  const fee = premium ? craftingFeePerCraft * (1 - PREMIUM_FEE_DISCOUNT) : craftingFeePerCraft;
  const totalCostPerCraft = materialCostPerCraft + fee;

  const outputPerCraft = effectiveOutput(batchSize, rrr);
  const revenuePerCraft = outputPerCraft * sellPrice * (1 - marketTax);
  const profitPerCraft = revenuePerCraft - totalCostPerCraft;
  const profitPerUnit = outputPerCraft > 0 ? profitPerCraft / outputPerCraft : 0;
  const breakEvenUnitPrice = outputPerCraft > 0
    ? totalCostPerCraft / (outputPerCraft * (1 - marketTax))
    : 0;

  return {
    materialCostPerCraft,
    craftingFee: fee,
    totalCostPerCraft,
    outputPerCraft,
    revenuePerCraft,
    profitPerCraft,
    profitPerUnit,
    breakEvenUnitPrice,
    rrr
  };
}

export { BASE_RRR, FOCUS_BASE_RRR };
