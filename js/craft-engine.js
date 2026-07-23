/*
 * craft-engine.js
 * High-level orchestrator: given an item, produce the recipe view (batch-aware),
 * fetch prices for materials + output, compute profit metrics.
 */

import { getItem } from "./data-loader.js";
import { fetchPrices, pickCitySellPrice, pickCityBuyPrice, CITIES } from "./api.js";
import { computeProfit, estimateRRR } from "./bonus-calculator.js";
import { Settings } from "./settings.js";

export async function buildRecipeView(catalog, itemId) {
  const item = getItem(catalog, itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);
  const materials = item.materials.map((m) => {
    const matItem = getItem(catalog, m.id);
    return {
      id: m.id,
      qty: m.qty,
      name: matItem ? matItem.name : humanize(m.id),
      tier: matItem ? matItem.tier : 0,
      price: 0,
      priceSource: "manual",
      priceUpdated: null
    };
  });
  return {
    item,
    batchSize: item.batchSize || 1,
    craftingFee: item.craftingFee || 0,
    materials,
    sellPrice: 0,
    sellPriceSource: "manual",
    sellPriceUpdated: null
  };
}

export async function autofillPrices(view, { city = "Caerleon", quality = 1 } = {}) {
  const allIds = [view.item.id, ...view.materials.map((m) => m.id)];
  const chunks = chunk(allIds, 60);
  const rows = [];
  for (const c of chunks) {
    try {
      const r = await fetchPrices(c, { locations: [city], qualities: [quality, 1] });
      rows.push(...r);
    } catch (err) {
      console.warn("AODP fetch failed:", err.message);
    }
  }
  const outSell = pickCitySellPrice(rows, city, quality) || pickCitySellPrice(rows, city, 1);
  if (outSell) {
    view.sellPrice = outSell.price;
    view.sellPriceSource = "market";
    view.sellPriceUpdated = outSell.updated;
  }
  for (const m of view.materials) {
    const idRows = rows.filter((r) => r.item_id === m.id);
    const pick = pickCityBuyPrice(idRows, city, 1) || pickCitySellPrice(idRows, city, 1);
    if (pick) {
      m.price = pick.price;
      m.priceSource = "market";
      m.priceUpdated = pick.updated;
    }
  }
  return view;
}

export function computeView(view, opts = {}) {
  const s = Settings.all();
  const premium = opts.premium ?? s.premium;
  const focus = opts.focus ?? s.focus;
  const city = opts.city ?? s.city;
  const useBonus = opts.useCraftingBonus ?? s.useCraftingBonus;
  const marketTax = premium ? s.marketTaxPremium : s.marketTaxNonPremium;

  const rrr = estimateRRR({
    city,
    category: view.item.category,
    subCategory: view.item.subCategory,
    focus,
    useCraftingBonus: useBonus
  });

  const metrics = computeProfit({
    materials: view.materials,
    batchSize: view.batchSize,
    sellPrice: view.sellPrice,
    craftingFeePerCraft: view.craftingFee,
    rrr,
    marketTax,
    premium
  });

  return { ...metrics, rrr, premium, focus, city, marketTax };
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function humanize(id) {
  return id.replace(/^T\d_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export { CITIES };
