// js/utils/fmt.js
// Formatting helpers.

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const pctf = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

export function silver(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return nf0.format(Math.round(n));
}

export function num(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return "-";
  return digits === 0 ? nf0.format(n) : nf2.format(n);
}

export function pct(x) {
  if (x == null || Number.isNaN(x)) return "-";
  return pctf.format(x);
}

export function relTime(isoOrDate) {
  if (!isoOrDate) return "never";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms)) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

// Utility to pick the localized name given a names map + language code.
export function localName(names, lang, fallbackId = "") {
  if (!names) return fallbackId;
  return names[lang] || names["EN-US"] || Object.values(names)[0] || fallbackId;
}

// AODP item icon URL
export function iconUrl(itemId, quality = 1, size = 64) {
  if (!itemId) return "";
  const q = quality || 1;
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png?quality=${q}&size=${size}`;
}
