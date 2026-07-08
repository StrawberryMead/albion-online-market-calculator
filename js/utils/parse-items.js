// js/utils/parse-items.js
// Shared parser used by both scripts/build-items.mjs (Node) and js/items.js (browser).
// Consumes the ao-bin-dumps root `items.json` (converted from items.xml) plus,
// optionally, `formatted/items.json` for LocalizedNames, and returns:
//   { items: [ {id, tier, enchant, category, subcat, names} ], recipes: { id: {...} } }

const ITEM_KEYS = [
  "simpleitem", "consumableitem", "consumablefrominventoryitem", "equipmentitem",
  "weapon", "mount", "farmableitem", "furnitureitem", "journalitem",
  "labourercontract", "crystalleagueitem", "trackingitem", "questitem_pool",
  "mountskin",
];

function pick(obj, ...keys) {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

function intOf(v) {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseUniqueName(uniqueName) {
  const m = /^T(\d+)_(.+?)(?:@(\d+))?$/.exec(uniqueName || "");
  if (!m) return { tier: 0, enchant: 0 };
  return { tier: parseInt(m[1], 10), enchant: m[3] ? parseInt(m[3], 10) : 0 };
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractMaterials(req) {
  return toArray(req.craftresource || req.CraftResource || req.craftresources)
    .map((m) => ({
      id: pick(m, "@uniquename", "UniqueName", "uniquename"),
      qty: intOf(pick(m, "@count", "Count", "count")) || 1,
    }))
    .filter((m) => m.id);
}

function recipeFromReq(req, defaultProduct) {
  const materials = extractMaterials(req);
  if (materials.length === 0) return null;
  return {
    craftingFee: intOf(pick(req, "@silver", "silver")),
    focusCost: intOf(pick(req, "@craftingfocus", "craftingfocus")),
    amount: intOf(pick(req, "@amount", "amount")) || 1,
    craftProductItem: pick(req, "@craftproductitem", "craftproductitem") || defaultProduct,
    time: intOf(pick(req, "@time", "time")),
    materials,
  };
}

function pushRecipesFromItem(item, defaultId, recipes) {
  const crs = toArray(item.craftingrequirements || item.CraftingRequirements);
  for (const req of crs) {
    const parsed = recipeFromReq(req, defaultId);
    if (!parsed) continue;
    const target = parsed.craftProductItem || defaultId;
    // Prefer first non-empty recipe; keep it stable.
    if (!recipes[target]) recipes[target] = parsed;
  }
}

function collect(list, items, recipes, names) {
  for (const it of toArray(list)) {
    const id = pick(it, "@uniquename", "UniqueName", "uniquename");
    if (!id) continue;
    if (id.startsWith("QUESTITEM_") || id.startsWith("UNIQUE_")) continue;
    const { tier: derivedTier, enchant: derivedEnchant } = parseUniqueName(id);
    const tier = intOf(pick(it, "@tier", "Tier")) || derivedTier;
    const enchant = intOf(pick(it, "@enchantmentlevel", "EnchantmentLevel")) || derivedEnchant;
    items.push({
      id,
      tier,
      enchant,
      category: pick(it, "@shopcategory", "ShopCategory") || "",
      subcat: pick(it, "@shopsubcategory1", "ShopSubCategory1") || "",
      names: names.get(id) || pick(it, "LocalizedNames") || {},
    });
    pushRecipesFromItem(it, id, recipes);

    const enchList = toArray(it.enchantments?.enchantment);
    for (const e of enchList) {
      const lvl = intOf(pick(e, "@enchantmentlevel", "enchantmentlevel"));
      if (!lvl) continue;
      const enchId = id.includes("@") ? id : `${id}@${lvl}`;
      items.push({
        id: enchId,
        tier,
        enchant: lvl,
        category: pick(it, "@shopcategory", "ShopCategory") || "",
        subcat: pick(it, "@shopsubcategory1", "ShopSubCategory1") || "",
        names: names.get(enchId) || names.get(id) || {},
      });
      pushRecipesFromItem(e, enchId, recipes);
    }
  }
}

// Build a Map<UniqueName, LocalizedNames> from the ao-bin-dumps formatted/items.json.
export function buildNameMap(formatted) {
  const map = new Map();
  if (!formatted) return map;
  const list = Array.isArray(formatted) ? formatted : (formatted.items ?? []);
  for (const e of list) {
    const id = e?.UniqueName || e?.uniquename;
    if (!id) continue;
    map.set(id, e?.LocalizedNames || e?.localizedNames || {});
  }
  return map;
}

// Main entry point. `root` is the parsed root items.json (with an `items` wrapper),
// `nameMap` is optional (Map<UniqueName, LocalizedNames>).
export function parseDump(root, nameMap = new Map()) {
  const bucket = root?.items || root;
  const items = [];
  const recipes = {};
  if (bucket && typeof bucket === "object") {
    for (const key of ITEM_KEYS) {
      if (bucket[key]) collect(bucket[key], items, recipes, nameMap);
    }
    // Fallback: walk any array-valued child we haven't looked at.
    for (const [k, v] of Object.entries(bucket)) {
      if (ITEM_KEYS.includes(k)) continue;
      if (k.startsWith("@")) continue;
      if (Array.isArray(v)) collect(v, items, recipes, nameMap);
    }
  }
  // Dedupe items by id (keep first)
  const seen = new Set();
  const deduped = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    deduped.push(it);
  }
  return { items: deduped, recipes };
}
