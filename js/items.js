// js/items.js
// Item + recipe index with an IndexedDB overlay so users can sync the latest
// data from ao-bin-dumps at runtime (single button).

import { get as getSetting } from "./settings.js";
import { parseDump, buildNameMap } from "./utils/parse-items.js";

const DB_NAME = "aomc";
const DB_VER = 1;
const STORE = "kv";
const KV_ITEMS       = "items_v1";
const KV_RECIPES     = "recipes_v1";
const KV_UPDATED     = "items_v1_updated_at";

const URL_ITEMS_ROOT      = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json";
const URL_ITEMS_FORMATTED = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

let INDEX = [];
let BY_ID = new Map();
let RECIPES = {};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function setIndex(list) {
  INDEX = list;
  BY_ID = new Map(list.map((it) => [it.id, it]));
}

function setRecipes(map) {
  RECIPES = map || {};
}

export async function loadItems() {
  // Prefer IDB overlay
  try {
    const overlay = await idbGet(KV_ITEMS);
    if (Array.isArray(overlay) && overlay.length > 0) {
      setIndex(overlay);
      const recOverlay = await idbGet(KV_RECIPES);
      if (recOverlay && typeof recOverlay === "object") setRecipes(recOverlay);
      else await loadRecipesFallback();
      return { source: "idb", count: overlay.length, recipeCount: Object.keys(RECIPES).length };
    }
  } catch (e) {
    console.warn("IDB items load failed", e);
  }
  // Shipped fallback
  const res = await fetch("data/items.min.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load data/items.min.json");
  const list = await res.json();
  setIndex(list);
  await loadRecipesFallback();
  return { source: "static", count: list.length, recipeCount: Object.keys(RECIPES).length };
}

async function loadRecipesFallback() {
  try {
    const res = await fetch("data/recipes.min.json", { cache: "no-cache" });
    if (res.ok) {
      const map = await res.json();
      setRecipes(map);
    }
  } catch (e) {
    console.warn("Failed to load shipped recipes.min.json", e);
    setRecipes({});
  }
}

// Sync the latest items + recipes straight from ao-bin-dumps and store them in
// IndexedDB. Both files are fetched in parallel; either can degrade gracefully.
export async function refreshFromRemote(onProgress = () => {}) {
  onProgress("Fetching items.json (full dump)...");
  const [rootDump, formatted] = await Promise.all([
    fetch(URL_ITEMS_ROOT, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`items.json HTTP ${r.status}`);
      return r.json();
    }),
    fetch(URL_ITEMS_FORMATTED, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  onProgress("Parsing...");
  const nameMap = buildNameMap(formatted);
  const { items, recipes } = parseDump(rootDump, nameMap);
  if (items.length === 0) throw new Error("Parsed 0 items from dump");
  onProgress(`Storing ${items.length.toLocaleString()} items and ${Object.keys(recipes).length.toLocaleString()} recipes...`);
  await idbPut(KV_ITEMS, items);
  await idbPut(KV_RECIPES, recipes);
  await idbPut(KV_UPDATED, new Date().toISOString());
  setIndex(items);
  setRecipes(recipes);
  return { count: items.length, recipeCount: Object.keys(recipes).length };
}

export async function clearOverlay() {
  await idbPut(KV_ITEMS, null);
  await idbPut(KV_RECIPES, null);
  await idbPut(KV_UPDATED, null);
  return loadItems();
}

export async function getUpdatedAt() {
  try { return await idbGet(KV_UPDATED); } catch { return null; }
}

export function getById(id) { return BY_ID.get(id) || null; }
export function all()       { return INDEX; }
export function count()     { return INDEX.length; }

export function getRecipe(id) { return RECIPES[id] || null; }
export function allRecipes()  { return RECIPES; }
export function recipeCount() { return Object.keys(RECIPES).length; }

// Fuzzy-ish search across localized name (current language + EN-US) and UniqueName.
export function search(query, opts = {}) {
  const limit = opts.limit ?? 40;
  if (!query || !query.trim()) return [];
  const lang = getSetting("language") || "EN-US";
  const q = query.toLowerCase().trim();
  const qU = query.toUpperCase().trim();
  const tokens = q.split(/\s+/);
  const results = [];
  for (const it of INDEX) {
    const nameA = (it.names?.[lang] || "").toLowerCase();
    const nameB = (it.names?.["EN-US"] || "").toLowerCase();
    const id = it.id.toLowerCase();
    let ok = true;
    for (const t of tokens) {
      if (!nameA.includes(t) && !nameB.includes(t) && !id.includes(t)) { ok = false; break; }
    }
    if (!ok) continue;
    let score = 0;
    if (nameA.startsWith(q)) score += 100;
    if (nameB.startsWith(q)) score += 80;
    if (nameA.includes(q))   score += 40;
    if (it.id.startsWith(qU)) score += 60;
    score -= (it.tier || 0);
    score -= (it.enchant || 0) * 0.5;
    results.push({ item: it, score });
    if (results.length > limit * 5) break;
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => r.item);
}
