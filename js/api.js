// js/api.js
// Albion Online Data Project client.
// Docs: https://www.albion-online-data.com/api/

import { serverHost, get as getSetting } from "./settings.js";

const CACHE = new Map(); // key -> { ts, data }

function cacheKey(kind, url) { return `${kind}::${url}`; }

function fromCache(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  const ttl = (getSetting("cacheTtlSec") ?? 300) * 1000;
  if (Date.now() - hit.ts > ttl) return null;
  return hit.data;
}

function toCache(key, data) {
  CACHE.set(key, { ts: Date.now(), data });
}

// Chunk items so each request URL stays under ~3800 chars.
function chunkItemIds(itemIds, maxUrlLen = 3800, prefixLen = 200) {
  const chunks = [];
  let cur = [];
  let len = prefixLen;
  for (const id of itemIds) {
    const add = encodeURIComponent(id).length + 1; // +1 for comma
    if (len + add > maxUrlLen && cur.length > 0) {
      chunks.push(cur);
      cur = [];
      len = prefixLen;
    }
    cur.push(id);
    len += add;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return await res.json();
}

// GET /api/v2/stats/prices/{items}?locations=...&qualities=...
// Returns array of { item_id, city, quality, sell_price_min, sell_price_min_date, sell_price_max, buy_price_min, buy_price_min_date, buy_price_max, ... }
export async function getPrices(itemIds, { locations, qualities } = {}) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return [];
  const host = serverHost();
  const locParam = locations && locations.length ? `&locations=${locations.map(encodeURIComponent).join(",")}` : "";
  const qParam = qualities && qualities.length ? `&qualities=${qualities.join(",")}` : "";
  const chunks = chunkItemIds(itemIds);
  const allResults = [];
  for (const group of chunks) {
    const url = `${host}/api/v2/stats/prices/${group.map(encodeURIComponent).join(",")}.json?${locParam.slice(1)}${qParam}`;
    const key = cacheKey("prices", url);
    let data = fromCache(key);
    if (!data) {
      data = await fetchJson(url);
      toCache(key, data);
    }
    allResults.push(...data);
  }
  return allResults;
}

// GET /api/v2/stats/history/{items}?locations=...&qualities=...&date=...&end_date=...&time-scale=1|6|24
// time-scale: 1 = hourly, 6 = 6h, 24 = daily
// Returns array of { item_id, location, quality, data:[{ item_count, avg_price, timestamp }] }
export async function getHistory(itemIds, { locations, qualities, timeScale = 24, days = 7 } = {}) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return [];
  const host = serverHost();
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => encodeURIComponent(d.toISOString().slice(0, 10));
  const locParam = locations && locations.length ? `locations=${locations.map(encodeURIComponent).join(",")}` : "";
  const qParam = qualities && qualities.length ? `qualities=${qualities.join(",")}` : "";
  const dateParam = `date=${fmt(start)}&end_date=${fmt(now)}&time-scale=${timeScale}`;
  const params = [locParam, qParam, dateParam].filter(Boolean).join("&");
  const chunks = chunkItemIds(itemIds);
  const allResults = [];
  for (const group of chunks) {
    const url = `${host}/api/v2/stats/history/${group.map(encodeURIComponent).join(",")}.json?${params}`;
    const key = cacheKey("hist", url);
    let data = fromCache(key);
    if (!data) {
      data = await fetchJson(url);
      toCache(key, data);
    }
    allResults.push(...data);
  }
  return allResults;
}

export function clearCache() {
  CACHE.clear();
}
