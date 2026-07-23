import { $, $$, toast } from "./utils/dom.js";
import { Settings } from "./settings.js";
import * as EquipmentTab from "./tabs/equipment.js";
import * as PotionsTab from "./tabs/potions.js";
import * as FoodsTab from "./tabs/foods.js";
import * as PricesTab from "./tabs/prices.js";
import * as SettingsTab from "./tabs/settings.js";

const TABS = {
  equipment: EquipmentTab,
  potions: PotionsTab,
  foods: FoodsTab,
  prices: PricesTab,
  settings: SettingsTab
};

const DEFAULT_TAB = "equipment";
const mounted = new Set();

async function activate(name) {
  const key = TABS[name] ? name : DEFAULT_TAB;
  for (const a of $$(".tab")) a.classList.toggle("active", a.dataset.tab === key);
  for (const p of $$(".tab-panel")) p.classList.toggle("active", p.id === `tab-${key}`);
  if (!mounted.has(key)) {
    try {
      await TABS[key].mount(document.getElementById(`tab-${key}`));
      mounted.add(key);
    } catch (err) {
      console.error("Tab mount failed:", err);
      toast(`Tab error: ${err.message}`, "error");
    }
  }
}

function currentHashTab() {
  const raw = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
  return raw && TABS[raw] ? raw : DEFAULT_TAB;
}

function updateServerBadge() {
  const badge = $("#server-badge");
  if (!badge) return;
  const label = ({ america: "America", europe: "Europe", asia: "Asia" }[Settings.get("server")]) || "America";
  badge.textContent = label;
}

window.addEventListener("hashchange", () => activate(currentHashTab()));
window.addEventListener("settings-changed", (e) => {
  if (e.detail && "server" in e.detail) updateServerBadge();
});

document.addEventListener("DOMContentLoaded", () => {
  updateServerBadge();
  if (!location.hash) location.hash = `#${DEFAULT_TAB}`;
  activate(currentHashTab());
});
