/*
 * api.js
 * Client for the Albion Online Data Project (AODP).
 * Endpoints per server:
 *   America: https://west.albion-online-data.com/api/v2/stats/prices/<items>?locations=<cities>&qualities=<q>
 *   Europe : https://europe.albion-online-data.com/api/...
 *   Asia   : https://east.albion-online-data.com/api/...
 */

import { Settings } from "./settings.js";

const SERVER_HOSTS = {
  america: "west.albion-online-data.com",
  europe: "europe.albion-online-data.com",
  asia: "east.albion-online-data.com"
};

export const CITIES = [
  "Bridgewatch", "Caerleon", "Fort Sterling", "Lymhurst", "Martlock", "Thetford", "Brecilien"
];

const memoryCache = new Map();

function ttlMs() {
  return (Number(Settings.get("cacheTtlMinutes")) || 15) * 60_000;
}

function baseUrl() {
  const server = Settings.get("server") || "america";
  const host = SERVER_HOSTS[server] || SERVER_HOSTS.america;
  return `https://${host}/api/v2/stats`;
}

function cacheKey(kind, params) {
  return `${kind}::${JSON.stringify(params)}::${Settings.get("server")}`;
}

async function cachedFetch(url, key) {
  const now = Date.now();
  const hit = memoryCache.get(key);
  if (hit && now - hit.time < ttlMs()) return hit.data;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`AODP error ${res.status}`);
  const data = await res.json();
  memoryCache.set(key, { time: now, data });
  return data;
}

export async function fetchPrices(itemIds, {
  locations = CITIES,
  qualities = [1, 2, 3, 4, 5]
} = {}) {
  if (!itemIds || itemIds.length === 0) return [];
  const ids = Array.isArray(itemIds) ? itemIds.join(",") : itemIds;
  const params = new URLSearchParams();
  params.set("locations", locations.join(","));
  params.set("qualities", qualities.join(","));
  const url = `${baseUrl()}/prices/${encodeURIComponent(ids)}?${params.toString()}`;
  const key = cacheKey("prices", { ids, locations, qualities });
  return cachedFetch(url, key);
}

export async function fetchHistory(itemId, { location = "Caerleon", quality = 1, timeScale = 24 } = {}) {
  const params = new URLSearchParams();
  params.set("locations", location);
  params.set("qualities", String(quality));
  params.set("time-scale", String(timeScale));
  const url = `${baseUrl()}/history/${encodeURIComponent(itemId)}?${params.toString()}`;
  const key = cacheKey("history", { itemId, location, quality, timeScale });
  return cachedFetch(url, key);
}

export function clearPriceCache() {
  memoryCache.clear();
}

/*
 * Pick the "market sell" reference price for a given item id across the requested cities.
 * Uses sell_price_min as the practical selling price, ignoring 0 (no data).
 */
export function pickCitySellPrice(rows, city, quality = 1) {
  if (!Array.isArray(rows)) return null;
  for (const r of rows) {
    if (r.city !== city) continue;
    if (Number(r.quality) !== Number(quality)) continue;
    const p = Number(r.sell_price_min);
    if (p > 0) return { price: p, updated: r.sell_price_min_date };
  }
  return null;
}

export function pickCityBuyPrice(rows, city, quality = 1) {
  if (!Array.isArray(rows)) return null;
  for (const r of rows) {
    if (r.city !== city) continue;
    if (Number(r.quality) !== Number(quality)) continue;
    const p = Number(r.buy_price_max);
    if (p > 0) return { price: p, updated: r.buy_price_max_date };
  }
  return null;
}
