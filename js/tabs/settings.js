// js/tabs/settings.js

import { h, clear, toast } from "../utils/dom.js";
import { relTime } from "../utils/fmt.js";
import * as Settings from "../settings.js";
import { SERVERS, LANGUAGES } from "../settings.js";
import * as Items from "../items.js";
import { clearCache } from "../api.js";

export async function render(host) {
  clear(host);
  const s = Settings.getSettings();
  const updatedAt = await Items.getUpdatedAt();

  const serverCard = h("div", { class: "card" },
    h("h2", null, "Server"),
    h("div", { class: "field" },
      h("label", null, "Data server"),
      h("select", { onchange: e => { Settings.set("server", e.target.value); toast("Server: " + SERVERS[e.target.value].label); refreshBadge(); } },
        ...Object.entries(SERVERS).map(([k, v]) => h("option", { value: k, selected: s.server === k ? "" : null }, v.label))
      )
    )
  );

  const localeCard = h("div", { class: "card" },
    h("h2", null, "Localization"),
    h("div", { class: "field" },
      h("label", null, "Item name language"),
      h("select", { onchange: e => { Settings.set("language", e.target.value); toast("Language: " + e.target.value); } },
        ...LANGUAGES.map(l => h("option", { value: l, selected: s.language === l ? "" : null }, l))
      )
    )
  );

  const cacheCard = h("div", { class: "card" },
    h("h2", null, "Cache"),
    h("div", { class: "field" },
      h("label", null, "Price cache TTL (seconds)"),
      h("input", { type: "number", min: "10", step: "10", value: s.cacheTtlSec, oninput: e => Settings.set("cacheTtlSec", +e.target.value) })
    ),
    h("button", { onclick: () => { clearCache(); toast("Price cache cleared", "success"); } }, "Clear price cache")
  );

  const rateCard = h("div", { class: "card" },
    h("h2", null, "Crafting defaults"),
    h("div", { class: "grid-2" },
      h("div", { class: "field" },
        h("label", null, "Return rate (city, no focus)"),
        h("input", { type: "number", step: "0.001", min: "0", max: "1", value: s.returnRate, oninput: e => Settings.set("returnRate", +e.target.value) })
      ),
      h("div", { class: "field" },
        h("label", null, "Return rate (with focus)"),
        h("input", { type: "number", step: "0.001", min: "0", max: "1", value: s.focusReturnRate, oninput: e => Settings.set("focusReturnRate", +e.target.value) })
      )
    )
  );

  const itemsCard = h("div", { class: "card" },
    h("h2", null, "Item and recipe database"),
    h("div", null,
      "Items loaded: ", h("strong", null, Items.count().toLocaleString()),
      h("br"),
      "Recipes loaded: ", h("strong", null, Items.recipeCount().toLocaleString()),
      updatedAt ? h("div", { class: "hint", style: "margin-top:4px;" }, `Last sync: ${relTime(updatedAt)}`) : h("div", { class: "hint", style: "margin-top:4px;" }, "Using shipped files")
    ),
    h("div", { id: "sync-status", class: "hint", style: "margin-top:8px;" }),
    h("div", { style: "margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;" },
      h("button", { id: "sync-btn", class: "primary", onclick: doRefresh }, "Update from ao-bin-dumps"),
      h("button", { onclick: doClearOverlay }, "Reset to shipped files")
    ),
    h("div", { class: "hint", style: "margin-top:8px;" }, "Fetches items.json (full dump w/ crafting requirements) and formatted/items.json (localized names) from ao-data/ao-bin-dumps. Results are stored in IndexedDB. This runs entirely in your browser and may transfer ~20-30 MB.")
  );

  const aboutCard = h("div", { class: "card" },
    h("h2", null, "About"),
    h("div", null,
      "Static site. Deploy by pushing to GitHub Pages. Data comes from the ", h("a", { href: "https://www.albion-online-data.com/", target: "_blank", rel: "noopener" }, "Albion Online Data Project"),
      " and ", h("a", { href: "https://github.com/ao-data/ao-bin-dumps", target: "_blank", rel: "noopener" }, "ao-bin-dumps"), "."
    ),
    h("div", { class: "hint", style: "margin-top:8px;" }, "Not affiliated with, endorsed, sponsored, or specifically approved by Sandbox Interactive.")
  );

  host.append(serverCard, localeCard, cacheCard, rateCard, itemsCard, aboutCard);

  async function doRefresh() {
    const btn = host.querySelector("#sync-btn");
    const status = host.querySelector("#sync-status");
    if (btn) { btn.disabled = true; btn.textContent = "Syncing..."; }
    const onProgress = (msg) => { if (status) status.textContent = msg; };
    onProgress("Starting sync...");
    try {
      const { count, recipeCount } = await Items.refreshFromRemote(onProgress);
      toast(`Updated: ${count.toLocaleString()} items, ${recipeCount.toLocaleString()} recipes`, "success");
      render(host);
    } catch (e) {
      if (status) status.textContent = "";
      toast("Update failed: " + e.message, "error", 6000);
      if (btn) { btn.disabled = false; btn.textContent = "Update from ao-bin-dumps"; }
    }
  }
  async function doClearOverlay() {
    try {
      await Items.clearOverlay();
      toast("Reverted to shipped databases", "success");
      render(host);
    } catch (e) {
      toast("Reset failed: " + e.message, "error");
    }
  }
}

function refreshBadge() {
  const b = document.getElementById("server-badge");
  if (!b) return;
  const s = Settings.get("server");
  b.textContent = s === "west" ? "West" : s === "east" ? "East" : "Europe";
}
