/*
 * data-loader.js
 * Runtime loader for ao-bin-dumps submodule.
 * Fetches ao-bin-dumps/formatted/items.json + itemsignored, extracts craftable items and recipes.
 *
 * We rely on the fact that items.json contains an `items` object with several arrays keyed by
 * item family (weapon, equipmentitem, consumableitem, etc.). Each entry can have a
 * `craftingrequirements` object containing `craftresource` (array of {@uniquename, @count})
 * and `@amountcrafted` (default 1) plus `@silverkitpriceperunit` or similar fees.
 *
 * If ao-bin-dumps is not available at runtime (e.g. locally without submodule) we fall back to
 * a bundled `data/seed-items.json` so the UI can still be tested.
 */

const REMOTE_BASE = "ao-bin-dumps/formatted";
const LOCALIZATION_URL = `${REMOTE_BASE}/items.json`;
const FALLBACK_URL = "data/seed-items.json";

let cache = null;
let loadingPromise = null;

export async function loadCatalog({ force = false } = {}) {
  if (cache && !force) return cache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let source = LOCALIZATION_URL;
    let raw = null;
    try {
      const res = await fetch(LOCALIZATION_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.json();
    } catch (err) {
      console.warn("ao-bin-dumps not reachable, using seed data:", err.message);
      source = FALLBACK_URL;
      const res = await fetch(FALLBACK_URL);
      if (!res.ok) throw new Error("No data source available");
      raw = await res.json();
    }
    cache = normalize(raw, source);
    return cache;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

function normalize(raw, source) {
  const items = [];
  const byId = new Map();
  const collectItem = (record, family, category) => {
    const id = record["@uniquename"] || record.uniqueName || record.uniquename;
    if (!id) return;
    const tier = parseTierFromId(id);
    const enchant = parseEnchantFromId(id);
    const item = {
      id,
      family,
      category,
      subCategory: guessSubCategory(id, category),
      tier,
      enchant,
      name: humanizeId(id),
      batchSize: parseBatch(record),
      craftingFee: parseFee(record),
      focusCost: parseFocus(record),
      materials: parseMaterials(record),
      raw: record
    };
    items.push(item);
    byId.set(id, item);
  };

  const root = raw && raw.items ? raw.items : raw;
  if (root && typeof root === "object") {
    for (const [family, group] of Object.entries(root)) {
      const category = mapFamilyToCategory(family);
      if (Array.isArray(group)) {
        for (const entry of group) collectItem(entry, family, category);
      } else if (group && typeof group === "object" && group["@uniquename"]) {
        collectItem(group, family, category);
      }
    }
  }

  return {
    source,
    items,
    byId,
    byCategory: groupByCategory(items),
    loadedAt: new Date().toISOString()
  };
}

function groupByCategory(items) {
  const map = { equipment: [], potions: [], foods: [], other: [] };
  for (const it of items) {
    if (!it.materials.length) continue;
    if (map[it.category]) map[it.category].push(it);
    else map.other.push(it);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }
  return map;
}

function mapFamilyToCategory(family) {
  const f = family.toLowerCase();
  if (f.includes("consumable") && (f.includes("potion") || f.includes("alchemy"))) return "potions";
  if (f.includes("consumable") && (f.includes("food") || f.includes("cook"))) return "foods";
  if (f.includes("weapon") || f.includes("armor") || f.includes("equipment") || f.includes("shield")
      || f.includes("mount") || f.includes("bag") || f.includes("cape") || f.includes("tool")) return "equipment";
  return "other";
}

function guessSubCategory(id, category) {
  const s = id.toUpperCase();
  if (category === "equipment") {
    if (s.includes("ARMOR_PLATE") || s.includes("HEAD_PLATE") || s.includes("SHOES_PLATE")) return "plate";
    if (s.includes("ARMOR_LEATHER") || s.includes("HEAD_LEATHER") || s.includes("SHOES_LEATHER")) return "leather";
    if (s.includes("ARMOR_CLOTH") || s.includes("HEAD_CLOTH") || s.includes("SHOES_CLOTH")) return "cloth";
  }
  if (category === "potions") {
    if (s.includes("POTION_HEAL")) return "potion_healing";
    if (s.includes("POTION_STICKYBOMB") || s.includes("POTION_POISON")) return "potion_poison";
    if (s.includes("POTION_FEAR")) return "potion_fear";
    if (s.includes("POTION_INVIS")) return "potion_invis";
    if (s.includes("POTION_GIGANTIFY")) return "potion_gigantify";
  }
  if (category === "foods") {
    if (s.includes("MEAL_SOUP")) return "cook_soup";
    if (s.includes("MEAL_STEW")) return "cook_stew";
    if (s.includes("MEAL_OMELETTE")) return "cook_omelette";
    if (s.includes("MEAL_SALAD")) return "cook_salad";
    if (s.includes("MEAL_PIE")) return "cook_pie";
    if (s.includes("MEAL_SANDWICH")) return "cook_sandwich";
    if (s.includes("MEAL_ROAST")) return "cook_roast";
  }
  return "";
}

function parseTierFromId(id) {
  const m = /T(\d)/.exec(id);
  return m ? Number(m[1]) : 0;
}

function parseEnchantFromId(id) {
  const m = /@(\d)/.exec(id);
  return m ? Number(m[1]) : 0;
}

function parseBatch(record) {
  const cr = record.craftingrequirements || record["craftingrequirements"];
  if (!cr) return 1;
  const first = Array.isArray(cr) ? cr[0] : cr;
  const amt = first && (first["@amountcrafted"] || first.amountcrafted);
  const n = Number(amt);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseFee(record) {
  const cr = record.craftingrequirements;
  const first = Array.isArray(cr) ? cr[0] : cr;
  if (!first) return 0;
  const raw = first["@silver"] || first["@silvercost"] || first["@silverkitpriceperunit"] || 0;
  return Number(raw) || 0;
}

function parseFocus(record) {
  const cr = record.craftingrequirements;
  const first = Array.isArray(cr) ? cr[0] : cr;
  if (!first) return 0;
  const raw = first["@craftingfocus"] || first["@focus"] || 0;
  return Number(raw) || 0;
}

function parseMaterials(record) {
  const cr = record.craftingrequirements;
  const first = Array.isArray(cr) ? cr[0] : cr;
  if (!first) return [];
  const cr2 = first.craftresource || first["craftresource"];
  if (!cr2) return [];
  const arr = Array.isArray(cr2) ? cr2 : [cr2];
  return arr.map((m) => ({
    id: m["@uniquename"] || m.uniquename,
    qty: Number(m["@count"] || m.count) || 1,
    maxReturnAmount: Number(m["@maxreturnamount"] || 0) || null
  })).filter((m) => m.id);
}

function humanizeId(id) {
  return id
    .replace(/^T\d_/, "")
    .replace(/_/g, " ")
    .replace(/@\d/, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function findItems(catalog, category, query) {
  const list = catalog.byCategory[category] || [];
  if (!query) return list.slice(0, 200);
  const q = query.toLowerCase();
  return list
    .filter((it) => it.id.toLowerCase().includes(q) || it.name.toLowerCase().includes(q))
    .slice(0, 200);
}

export function getItem(catalog, id) {
  return catalog.byId.get(id) || null;
}
