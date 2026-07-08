#!/usr/bin/env node
// scripts/build-items.mjs
// Fetch ao-bin-dumps root items.json (full data w/ craftingrequirements) plus
// formatted/items.json (LocalizedNames), and produce:
//   data/items.min.json    (item index for autocomplete + icons)
//   data/recipes.min.json  (crafting recipes indexed by produced item id)
//
// Usage:
//   node scripts/build-items.mjs
//   node scripts/build-items.mjs --items ./items.json --formatted ./formatted-items.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDump, buildNameMap } from "../js/utils/parse-items.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_ITEMS   = path.join(REPO_ROOT, "data", "items.min.json");
const OUT_RECIPES = path.join(REPO_ROOT, "data", "recipes.min.json");

const URL_ITEMS_ROOT  = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json";
const URL_ITEMS_FORMATTED = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

async function loadJson(source, urlHint) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${source}`);
  if (idx !== -1 && args[idx + 1]) {
    const p = path.resolve(args[idx + 1]);
    console.log(`[${source}] local: ${p}`);
    return JSON.parse(await fs.readFile(p, "utf8"));
  }
  console.log(`[${source}] fetch: ${urlHint}`);
  const res = await fetch(urlHint);
  if (!res.ok) throw new Error(`fetch ${urlHint} -> ${res.status}`);
  return await res.json();
}

async function main() {
  const [rootDump, formatted] = await Promise.all([
    loadJson("items", URL_ITEMS_ROOT),
    loadJson("formatted", URL_ITEMS_FORMATTED).catch((e) => {
      console.warn(`[formatted] optional load failed: ${e.message}`);
      return null;
    }),
  ]);

  const nameMap = buildNameMap(formatted);
  console.log(`Localized names in map: ${nameMap.size}`);

  const { items, recipes } = parseDump(rootDump, nameMap);
  console.log(`Items: ${items.length}`);
  console.log(`Recipes: ${Object.keys(recipes).length}`);

  await fs.mkdir(path.dirname(OUT_ITEMS), { recursive: true });
  await fs.writeFile(OUT_ITEMS, JSON.stringify(items));
  await fs.writeFile(OUT_RECIPES, JSON.stringify(recipes));
  console.log(`Wrote ${OUT_ITEMS} (${(await fs.stat(OUT_ITEMS)).size / 1024 | 0} KiB)`);
  console.log(`Wrote ${OUT_RECIPES} (${(await fs.stat(OUT_RECIPES)).size / 1024 | 0} KiB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
