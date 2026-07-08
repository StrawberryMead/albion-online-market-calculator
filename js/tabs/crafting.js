// js/tabs/crafting.js

import { h, clear, toast } from "../utils/dom.js";
import { silver, num, pct, iconUrl, localName } from "../utils/fmt.js";
import { itemSearch, bestOf } from "./_common.js";
import { getPrices } from "../api.js";
import * as Items from "../items.js";
import { get as getSetting } from "../settings.js";

let recipesPromise;
async function recipes() {
  if (!recipesPromise) {
    recipesPromise = fetch("data/recipes.min.json").then(r => r.json());
  }
  return recipesPromise;
}

let stationsPromise;
async function stations() {
  if (!stationsPromise) {
    stationsPromise = fetch("data/stations.json").then(r => r.json());
  }
  return stationsPromise;
}

let target = null;
let recipe = null;
let materialPrices = {}; // itemId -> chosen price (default: best sell min across selected cities)
let sellCity = "";
let useFocus = false;

export async function render(host) {
  clear(host);
  const rmap = await recipes();
  const sta = await stations();
  const lang = getSetting("language") || "EN-US";

  const searchCard = h("div", { class: "card" },
    h("h2", null, "Crafting profit"),
    h("div", { class: "hint" }, `Recipe database is bootstrapped with a small starter set (${Object.keys(rmap).length} items). Extend data/recipes.min.json to cover more items.`),
    h("div", { style: "margin-top:8px;" })
  );
  const search = itemSearch((it) => {
    target = it;
    recipe = rmap[it.id];
    if (!recipe) {
      toast(`No recipe for ${it.id}. Add it to data/recipes.min.json.`, "error");
      return;
    }
    materialPrices = {};
    renderDetail();
  }, { placeholder: "Search item to craft..." });
  searchCard.append(search.el);
  host.append(searchCard);

  const detail = h("div");
  host.append(detail);

  async function renderDetail() {
    clear(detail);
    if (!target || !recipe) return;

    const cities = sta.cities.map(c => c.id);
    if (!sellCity) sellCity = "Caerleon";

    const head = h("div", { class: "card" },
      h("div", { class: "item-detail-head" },
        h("img", { src: iconUrl(target.id, 1, 64) }),
        h("div", null,
          h("div", { class: "name" }, localName(target.names, lang, target.id)),
          h("div", { class: "id" }, target.id)
        )
      ),
      h("div", { class: "row" },
        h("div", { class: "col" },
          h("label", null, "Sell city"),
          h("select", { onchange: e => { sellCity = e.target.value; refresh(); } },
            ...cities.map(c => h("option", { value: c, selected: c === sellCity ? "" : null }, c))
          )
        ),
        h("div", { class: "col" },
          h("label", null, "Return rate"),
          h("input", {
            type: "number", step: "0.001", min: "0", max: "1",
            value: useFocus ? getSetting("focusReturnRate") : getSetting("returnRate"),
            oninput: e => {
              if (useFocus) { window.__aomc_focusRR = +e.target.value; }
              else { window.__aomc_rr = +e.target.value; }
              recompute();
            },
          })
        ),
        h("div", { class: "col" },
          h("label", null, "Focus"),
          h("select", { onchange: e => { useFocus = e.target.value === "yes"; recompute(); } },
            h("option", { value: "no",  selected: useFocus ? null : "" }, "No"),
            h("option", { value: "yes", selected: useFocus ? "" : null }, "Yes"),
          )
        ),
        h("div", { class: "col" },
          h("label", null, "Crafting fee (silver/item)"),
          h("input", {
            type: "number", step: "1", min: "0",
            value: recipe.craftingFee ?? 0,
            oninput: e => { recipe = { ...recipe, craftingFee: +e.target.value }; recompute(); },
          })
        )
      )
    );
    detail.append(head);

    const matsCard = h("div", { class: "card" },
      h("div", { class: "card-title-row" },
        h("h3", null, "Materials"),
        h("button", { class: "small", onclick: refresh }, "Refresh prices")
      ),
      h("div", { class: "recipe-list", id: "mat-list" }, h("span", { class: "spinner" }), " loading...")
    );
    detail.append(matsCard);

    const summaryCard = h("div", { class: "card" },
      h("h3", null, "Result"),
      h("div", { id: "sum-out", class: "summary" })
    );
    detail.append(summaryCard);

    await refresh();
  }

  async function refresh() {
    const list = detail.querySelector("#mat-list");
    list.innerHTML = "";
    list.append(h("span", { class: "spinner" }), " loading prices...");
    const cities = sta.cities.map(c => c.id);
    const ids = [target.id, ...recipe.materials.map(m => m.id)];
    try {
      const rows = await getPrices(ids, { locations: cities, qualities: [1] });
      // Best sell price for each material (lowest sell_price_min across cities)
      for (const m of recipe.materials) {
        const cheap = rows.filter(r => r.item_id === m.id && r.sell_price_min > 0)
          .sort((a, b) => a.sell_price_min - b.sell_price_min)[0];
        if (cheap) {
          materialPrices[m.id] = materialPrices[m.id] ?? cheap.sell_price_min;
        } else {
          materialPrices[m.id] = materialPrices[m.id] ?? 0;
        }
      }
      // Item price at sellCity
      const itemRow = rows.filter(r => r.item_id === target.id && r.city === sellCity && r.quality === 1)[0];
      window.__aomc_itemSell = itemRow?.sell_price_min || 0;
      window.__aomc_itemBuy  = itemRow?.buy_price_max || 0;

      renderMaterials(rows);
      recompute();
    } catch (e) {
      list.innerHTML = "";
      list.append(h("div", { class: "error" }, "Failed to load prices: " + e.message));
    }
  }

  function renderMaterials(rows) {
    const list = detail.querySelector("#mat-list");
    list.innerHTML = "";
    for (const m of recipe.materials) {
      const item = Items.getById(m.id);
      const name = item ? localName(item.names, lang, m.id) : m.id;
      const row = h("div", { class: "recipe-row" },
        h("img", { src: iconUrl(m.id, 1, 40) }),
        h("div", null,
          h("div", null, name),
          h("div", { class: "id" }, m.id)
        ),
        h("div", { class: "qty" }, `x ${m.qty}`),
        h("input", {
          type: "number", min: "0", step: "1",
          value: materialPrices[m.id] ?? 0,
          oninput: e => { materialPrices[m.id] = +e.target.value; recompute(); },
        }),
        h("div", { class: "qty" }, h("span", { class: "silver" }, silver((materialPrices[m.id] || 0) * m.qty)))
      );
      list.append(row);
    }
  }

  function recompute() {
    const rr = useFocus
      ? (window.__aomc_focusRR ?? getSetting("focusReturnRate"))
      : (window.__aomc_rr ?? getSetting("returnRate"));
    const rrClamped = Math.max(0, Math.min(0.99, rr));
    // Effective mat cost per crafted item, given return rate (materials refunded)
    let matCostRaw = 0;
    for (const m of recipe.materials) {
      matCostRaw += (materialPrices[m.id] || 0) * m.qty;
    }
    const matCostEff = matCostRaw * (1 - rrClamped);
    const craftFee = recipe.craftingFee ?? 0;
    const totalCost = matCostEff + craftFee;

    const itemSell = window.__aomc_itemSell || 0;
    const itemBuy  = window.__aomc_itemBuy  || 0;
    // Sell to buy order (instant) = buy_price_max minus 4% market tax
    // List on market (patient) = sell_price_min minus 6.5% listing tax (4% + 2.5% setup)
    const revInstant = itemBuy  * (1 - 0.04);
    const revPatient = itemSell * (1 - 0.065);

    const profitInstant = revInstant - totalCost;
    const profitPatient = revPatient - totalCost;

    const marginInstant = totalCost > 0 ? profitInstant / totalCost : 0;
    const marginPatient = totalCost > 0 ? profitPatient / totalCost : 0;

    const out = detail.querySelector("#sum-out");
    clear(out);
    out.append(
      cell("Raw mat cost", h("span", { class: "silver" }, silver(matCostRaw))),
      cell("After return", h("span", { class: "silver" }, silver(matCostEff))),
      cell("Crafting fee", h("span", { class: "silver" }, silver(craftFee))),
      cell("Total cost",   h("span", { class: "silver" }, silver(totalCost))),
      cell(`Sell @ ${sellCity} (instant)`, h("span", { class: "silver" }, silver(revInstant))),
      cell(`Sell @ ${sellCity} (patient)`, h("span", { class: "silver" }, silver(revPatient))),
      cell("Profit instant", h("span", { class: profitInstant >= 0 ? "silver" : "" }, silver(profitInstant)), profitInstant >= 0 ? "pos" : "neg"),
      cell("Profit patient", h("span", { class: profitPatient >= 0 ? "silver" : "" }, silver(profitPatient)), profitPatient >= 0 ? "pos" : "neg"),
      cell("Margin instant", pct(marginInstant), marginInstant >= 0 ? "pos" : "neg"),
      cell("Margin patient", pct(marginPatient), marginPatient >= 0 ? "pos" : "neg"),
    );
  }
}

function cell(label, value, cls = "") {
  return h("div", { class: "summary-cell" },
    h("div", { class: "label" }, label),
    h("div", { class: "value " + cls }, value)
  );
}
