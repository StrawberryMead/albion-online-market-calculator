// js/items.js
// Item index + IndexedDB overlay for on-demand refresh from ao-bin-dumps.

import { get as getSetting } from "./settings.js";

const DB_NAME = "aomc";
const DB_VER = 1;
const STORE = "kv";
const KV_ITEMS = "items_v1";
const KV_UPDATED = "items_v1_updated_at";

const REMOTE_ITEMS_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

let INDEX = [];   // Array of minified item entries
let BY_ID = new Map();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const r = st.get(key);
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
  BY_ID = new Map(list.map(it => [it.id, it]));
}

export async function loadItems() {
  // Prefer IDB overlay if present
  try {
    const overlay = await idbGet(KV_ITEMS);
    if (Array.isArray(overlay) && overlay.length > 0) {
      setIndex(overlay);
      return { source: "idb", count: overlay.length };
    }
  } catch (e) {
    console.warn("IDB load failed", e);
  }
  // Fall back to shipped file
  const res = await fetch("data/items.min.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load data/items.min.json");
  const list = await res.json();
  setIndex(list);
  return { source: "static", count: list.length };
}

// Parse "T4_BAG@1" style ids to derive tier/enchant from unknown ids.
function parseId(uniqueName) {
  const m = /^T(\d+)_(.+?)(?:@(\d+))?$/.exec(uniqueName);
  if (!m) return { tier: 0, enchant: 0 };
  return {
    tier: parseInt(m[1], 10),
    enchant: m[3] ? parseInt(m[3], 10) : 0,
  };
}

function minifyRaw(rawList) {
  const out = [];
  for (const entry of rawList) {
    const id = entry?.UniqueName;
    if (!id) continue;
    if (id.startsWith("QUESTITEM_") || id.startsWith("UNIQUE_")) continue;
    const { tier, enchant } = parseId(id);
    out.push({
      id,
      tier,
      enchant,
      category: entry?.ShopCategory || "",
      subcat: entry?.ShopSubCategory1 || "",
      names: entry?.LocalizedNames || {},
    });
  }
  return out;
}

export async function refreshFromRemote() {
  const res = await fetch(REMOTE_ITEMS_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch items.json (${res.status})`);
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : (raw.items ?? []);
  const minified = minifyRaw(list);
  if (minified.length === 0) throw new Error("Remote items.json produced 0 entries");
  await idbPut(KV_ITEMS, minified);
  await idbPut(KV_UPDATED, new Date().toISOString());
  setIndex(minified);
  return { count: minified.length };
}

export async function clearOverlay() {
  await idbPut(KV_ITEMS, null);
  await idbPut(KV_UPDATED, null);
  // Reload from static
  return loadItems();
}

export async function getUpdatedAt() {
  try { return await idbGet(KV_UPDATED); } catch { return null; }
}

export function getById(id) {
  return BY_ID.get(id) || null;
}

export function all() {
  return INDEX;
}

export function count() {
  return INDEX.length;
}

// Fuzzy-ish search: match all whitespace-separated tokens against localized name
// (in current language + EN-US) and against the UniqueName.
export function search(query, opts = {}) {
  const limit = opts.limit ?? 40;
  if (!query || !query.trim()) return [];
  const lang = getSetting("language") || "EN-US";
  const tokens = query.toLowerCase().trim().split(/\s+/);
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
    // Score: exact start match > name substring > id substring; higher tier last for stable order
    let score = 0;
    if (nameA.startsWith(query.toLowerCase())) score += 100;
    if (nameB.startsWith(query.toLowerCase())) score += 80;
    if (nameA.includes(query.toLowerCase())) score += 40;
    if (id.startsWith(query.toUpperCase())) score += 60;
    score -= (it.tier || 0);
    score -= (it.enchant || 0) * 0.5;
    results.push({ item: it, score });
    if (results.length > limit * 5) break;
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(r => r.item);
}
