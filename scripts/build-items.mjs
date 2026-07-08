#!/usr/bin/env node
// scripts/build-items.mjs
// Fetch the raw items.json from ao-bin-dumps and produce a minified,
// UI-friendly index at data/items.min.json.
//
// Usage:
//   node scripts/build-items.mjs
//   node scripts/build-items.mjs --source ./items.json   (use a local file)
//
// Output shape (array of objects):
//   {
//     id:        "T4_BAG",
//     tier:      4,
//     enchant:   0,
//     category:  "accessories",
//     subcat:    "bag",
//     names:     { "EN-US": "Adept's Bag", ... }
//   }

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(REPO_ROOT, "data", "items.min.json");
const REMOTE_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

async function loadSource() {
  const args = process.argv.slice(2);
  const localIdx = args.indexOf("--source");
  if (localIdx !== -1 && args[localIdx + 1]) {
    const p = path.resolve(args[localIdx + 1]);
    console.log(`Reading local source: ${p}`);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  }
  console.log(`Fetching ${REMOTE_URL} ...`);
  const res = await fetch(REMOTE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

// Parse "T4_BAG@1" style ids
function parseId(uniqueName) {
  const m = /^T(\d+)_(.+?)(?:@(\d+))?$/.exec(uniqueName);
  if (!m) return { tier: 0, enchant: 0 };
  return {
    tier: parseInt(m[1], 10),
    enchant: m[3] ? parseInt(m[3], 10) : 0,
  };
}

function minify(rawList) {
  const out = [];
  for (const entry of rawList) {
    // ao-bin-dumps items.json entries can be strings or objects; use object shape.
    const id = entry?.UniqueName || entry?.LocalizationNameVariable?.replace(/^@ITEMS_/, "");
    if (!id) continue;
    const { tier, enchant } = parseId(id);
    const names = entry?.LocalizedNames || {};
    const desc = entry?.LocalizedDescriptions || {};
    // Skip obvious non-market entries (test items, quest items) heuristically
    if (id.startsWith("QUESTITEM_") || id.startsWith("UNIQUE_")) continue;
    out.push({
      id,
      tier,
      enchant,
      category: entry?.ShopCategory || "",
      subcat: entry?.ShopSubCategory1 || "",
      names,
      hasDesc: !!desc && Object.keys(desc).length > 0,
    });
  }
  return out;
}

async function main() {
  const src = await loadSource();
  // ao-bin-dumps items.json is an array at the top level.
  const list = Array.isArray(src) ? src : (src.items ?? []);
  console.log(`Source entries: ${list.length}`);
  const minified = minify(list);
  console.log(`Minified entries: ${minified.length}`);
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(minified));
  const size = (await fs.stat(OUT_FILE)).size;
  console.log(`Wrote ${OUT_FILE} (${(size / 1024).toFixed(1)} KiB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
