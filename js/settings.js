const KEY = "moonlit-lily.settings.v1";

const DEFAULTS = {
  server: "america",
  language: "EN-US",
  premium: true,
  focus: false,
  city: "Caerleon",
  marketTaxPremium: 0.04,
  marketTaxNonPremium: 0.08,
  cacheTtlMinutes: 15,
  useCraftingBonus: true,
  qualityDefault: 1
};

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
}

export const Settings = {
  get(key) { return read()[key]; },
  all() { return { ...read() }; },
  set(key, value) {
    read();
    cache[key] = value;
    write();
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: { key, value } }));
  },
  update(partial) {
    read();
    Object.assign(cache, partial);
    write();
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: partial }));
  },
  defaults() { return { ...DEFAULTS }; }
};
