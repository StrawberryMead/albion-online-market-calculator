// js/app.js
// Bootstrap + tab router.

import * as Settings from "./settings.js";
import * as Items from "./items.js";
import { toast } from "./utils/dom.js";

import * as Prices from "./tabs/prices.js";
import * as Crafting from "./tabs/crafting.js";
import * as Refining from "./tabs/refining.js";
import * as Transport from "./tabs/transport.js";
import * as SettingsTab from "./tabs/settings.js";

const TABS = {
  prices:    { render: Prices.render,    host: "tab-prices" },
  crafting:  { render: Crafting.render,  host: "tab-crafting" },
  refining:  { render: Refining.render,  host: "tab-refining" },
  transport: { render: Transport.render, host: "tab-transport" },
  settings:  { render: SettingsTab.render, host: "tab-settings" },
};

let activeTab = null;
const rendered = new Set();

function activate(tabId) {
  if (!TABS[tabId]) tabId = "prices";
  activeTab = tabId;
  // Update tabs UI
  for (const a of document.querySelectorAll("#tabs .tab")) {
    a.classList.toggle("active", a.dataset.tab === tabId);
  }
  // Update panels
  for (const [id, def] of Object.entries(TABS)) {
    const el = document.getElementById(def.host);
    if (!el) continue;
    el.classList.toggle("active", id === tabId);
  }
  // Render (fresh each activation, except cache Settings changes)
  const panel = document.getElementById(TABS[tabId].host);
  try {
    TABS[tabId].render(panel);
    rendered.add(tabId);
  } catch (e) {
    console.error(e);
    toast("Failed to render tab: " + e.message, "error");
  }
}

function refreshServerBadge() {
  const b = document.getElementById("server-badge");
  if (!b) return;
  const s = Settings.get("server");
  b.textContent = s === "west" ? "West" : s === "east" ? "East" : "Europe";
}

function handleHash() {
  const raw = (location.hash || "#prices").slice(1);
  const [id] = raw.split("?");
  activate(id);
}

async function main() {
  refreshServerBadge();
  Settings.onChange(() => refreshServerBadge());

  try {
    const info = await Items.loadItems();
    if (info.count === 0) {
      toast("Item database is empty. Open Settings and click 'Update from ao-bin-dumps'.", "error", 8000);
    } else {
      console.log(`Loaded ${info.count} items (${info.source})`);
    }
  } catch (e) {
    console.error(e);
    toast("Failed to load item database: " + e.message + ". Open Settings to fetch it.", "error", 8000);
  }

  window.addEventListener("hashchange", handleHash);
  handleHash();
}

main().catch(err => {
  console.error(err);
  toast("Startup error: " + err.message, "error", 8000);
});
