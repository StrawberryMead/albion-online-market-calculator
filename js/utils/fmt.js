export function fmtSilver(n) {
  if (n == null || Number.isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return sign + abs.toLocaleString("en-US");
}

export function fmtSilverK(n) {
  if (n == null || Number.isNaN(n)) return "-";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(2)}m`;
  if (a >= 10_000)    return `${sign}${(a / 1_000).toFixed(1)}k`;
  return sign + Math.round(a).toLocaleString("en-US");
}

export function fmtPct(x, digits = 1) {
  if (x == null || Number.isNaN(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x, digits = 2) {
  if (x == null || Number.isNaN(x)) return "-";
  return Number(x).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function timeAgo(iso) {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "-";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
