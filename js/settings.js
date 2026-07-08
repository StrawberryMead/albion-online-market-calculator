// js/settings.js
// Persistent settings + change-event bus.

const KEY = "aomc.settings.v1";

const DEFAULTS = {
  server: "west",                       // "west" | "east" | "europe"
  language: "EN-US",
  qualities: [1, 2, 3, 4, 5],
  cities: [
    "Caerleon",
    "Bridgewatch",
    "Lymhurst",
    "Fort Sterling",
    "Martlock",
    "Thetford",
    "Brecilien",
    "Black Market",
  ],
  cacheTtlSec: 300,
  returnRate: 0.248,
  focusReturnRate: 0.435,
  craftingFeePer100nutrition: 0,
};

export const SERVERS = {
  west:   { label: "West (Americas)", host: "https://west.albion-online-data.com" },
  east:   { label: "East (Asia)",     host: "https://east.albion-online-data.com" },
  europe: { label: "Europe",          host: "https://europe.albion-online-data.com" },
};

export const LANGUAGES = [
  "EN-US","DE-DE","FR-FR","RU-RU","PL-PL","ES-ES","PT-BR","IT-IT",
  "ZH-CN","KO-KR","JA-JP","ZH-TW","ID-ID","TR-TR","AR-SA",
];

const listeners = new Set();
let cache = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
}

export function getSettings() {
  return { ...cache };
}

export function get(key) {
  return cache[key];
}

export function setMany(patch) {
  cache = { ...cache, ...patch };
  save();
  emit();
}

export function set(key, value) {
  cache[key] = value;
  save();
  emit();
}

export function reset() {
  cache = { ...DEFAULTS };
  save();
  emit();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(getSettings()); } catch (e) { console.error(e); }
  }
}

export function serverHost() {
  return SERVERS[cache.server]?.host || SERVERS.west.host;
}
