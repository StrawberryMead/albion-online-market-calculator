// js/tabs/refining.js
// Simple refining profit calculator.
// Formula per T (city refining bonus city gives +36% return with focus, +24.8% without):
//   Refined output requires: 1 lower-tier refined + N raw of same tier.
//   T3: 2, T4: 2, T5: 3, T6: 4, T7: 5, T8: 5 raw per refined (approx)
// User picks materials manually (raw + prev-tier refined) and enters their costs.

import { h, clear, toast } from "../utils/dom.js";
import { silver, pct, iconUrl, localName } from "../utils/fmt.js";
import { itemSearch } from "./_common.js";
import { getPrices } from "../api.js";
import * as Items from "../items.js";
import { get as getSetting } from "../settings.js";

let stationsPromise;
async function stations() {
  if (!stationsPromise) stationsPromise = fetch("data/stations.json").then(r => r.json());
  return stationsPromise;
}

// Raw : refined ratios (per Albion's refining formulas)
const RAW_PER_REFINED = {
  2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5,
};
const PREV_REFINED_PER_REFINED = {
  2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1,
};

let refined = null;   // e.g. T5_METALBAR (target)
let raw = null;       // e.g. T5_ORE
let prev = null;      // e.g. T4_METALBAR (auto-suggested if user picks a bar)
let sellCity = "Caerleon";
let useFocus = false;
let priceRefinedSell = 0, priceRefinedBuy = 0;
let priceRaw = 0, pricePrev = 0;

export async function render(host) {
  clear(host);
  const sta = await stations();
  const lang = getSetting("language") || "EN-US";

  const searchCard = h("div", { class: "card" },
    h("h2", null, "Refining profit"),
    h("div", { class: "hint" }, "Pick the refined output (e.g. T5 Steel Bar), the raw material (T5 Iron Ore), and previous-tier refined (T4 Steel Bar). Return rate defaults to city bonus."),
    h("div", { style: "margin-top:8px;" })
  );

  const sTarget = itemSearch((it) => {
    refined = it;
    autoFillCounterparts();
    renderDetail();
  }, { placeholder: "Refined output (e.g. T5 Steel Bar)..." });

  const sRaw = itemSearch((it) => { raw = it; renderDetail(); }, { placeholder: "Raw material..." });
  const sPrev = itemSearch((it) => { prev = it; renderDetail(); }, { placeholder: "Previous-tier refined..." });

  searchCard.append(
    h("div", { class: "grid-2" },
      wrapField("Refined output", sTarget.el),
      wrapField("Raw material", sRaw.el),
    ),
    h("div", { class: "grid-2" },
      wrapField("Previous-tier refined", sPrev.el),
      h("div", null,
        h("label", null, "Sell city / options"),
        h("div", { class: "row" },
          h("select", { onchange: e => { sellCity = e.target.value; refresh(); }, style: "flex:1;" },
            ...sta.cities.map(c => h("option", { value: c.id, selected: c.id === sellCity ? "" : null }, c.name))
          ),
          h("select", { onchange: e => { useFocus = e.target.value === "yes"; refresh(); } },
            h("option", { value: "no",  selected: useFocus ? null : "" }, "No focus"),
            h("option", { value: "yes", selected: useFocus ? "" : null }, "Focus"),
          ),
        )
      )
    )
  );
  host.append(searchCard);

  const detail = h("div");
  host.append(detail);

  function autoFillCounterparts() {
    if (!refined) return;
    // If pattern T{n}_METALBAR / T{n}_PLANKS / T{n}_LEATHER / T{n}_CLOTH / T{n}_STONEBLOCK
    const m = /^T(\d+)_(METALBAR|PLANKS|LEATHER|CLOTH|STONEBLOCK)$/.exec(refined.id);
    if (!m) return;
    const t = parseInt(m[1], 10);
    const rawByRefined = { METALBAR: "ORE", PLANKS: "WOOD", LEATHER: "HIDE", CLOTH: "FIBER", STONEBLOCK: "ROCK" };
    const rawKey = rawByRefined[m[2]];
    if (rawKey) {
      const rawId = `T${t}_${rawKey}`;
      raw = Items.getById(rawId) || { id: rawId, tier: t, names: { "EN-US": rawId } };
    }
    if (t > 2) {
      const prevId = `T${t - 1}_${m[2]}`;
      prev = Items.getById(prevId) || { id: prevId, tier: t - 1, names: { "EN-US": prevId } };
    } else {
      prev = null;
    }
  }

  async function renderDetail() {
    clear(detail);
    if (!refined) return;
    const t = refined.tier || 2;
    const rawN = RAW_PER_REFINED[t] ?? 2;
    const prevN = PREV_REFINED_PER_REFINED[t] ?? 1;

    const head = h("div", { class: "card" },
      h("div", { class: "item-detail-head" },
        h("img", { src: iconUrl(refined.id, 1, 64) }),
        h("div", null,
          h("div", { class: "name" }, localName(refined.names, lang, refined.id)),
          h("div", { class: "id" }, `${refined.id}  |  T${t}  |  requires ${rawN}x raw ${prevN ? `+ ${prevN}x prev refined` : ""}`)
        )
      ),
      h("div", { class: "recipe-list", id: "ref-list" }),
      h("hr"),
      h("div", { id: "ref-out", class: "summary" })
    );
    detail.append(head);

    await refresh();
  }

  async function refresh() {
    if (!refined) return;
    const t = refined.tier || 2;
    const rawN = RAW_PER_REFINED[t] ?? 2;
    const prevN = PREV_REFINED_PER_REFINED[t] ?? 1;
    const cities = sta.cities.map(c => c.id);
    const list = detail.querySelector("#ref-list");
    if (!list) return;
    list.innerHTML = "";
    list.append(h("span", { class: "spinner" }), " loading prices...");

    const ids = [refined.id, raw?.id, prev?.id].filter(Boolean);
    let rows = [];
    try {
      rows = await getPrices(ids, { locations: cities, qualities: [1] });
    } catch (e) {
      list.innerHTML = "";
      list.append(h("div", { class: "error" }, "Failed to load prices: " + e.message));
      return;
    }

    // Best sell (cheapest) for raw + prev refined
    const cheapest = (id) => {
      const r = rows.filter(x => x.item_id === id && x.sell_price_min > 0)
        .sort((a, b) => a.sell_price_min - b.sell_price_min)[0];
      return r?.sell_price_min || 0;
    };
    priceRaw = cheapest(raw?.id);
    pricePrev = cheapest(prev?.id);

    const at = (id) => rows.filter(x => x.item_id === id && x.city === sellCity && x.quality === 1)[0];
    priceRefinedSell = at(refined.id)?.sell_price_min || 0;
    priceRefinedBuy  = at(refined.id)?.buy_price_max  || 0;

    list.innerHTML = "";

    list.append(matRow(raw,  rawN, priceRaw,  v => { priceRaw = v; recompute(); }));
    if (prev && prevN > 0) list.append(matRow(prev, prevN, pricePrev, v => { pricePrev = v; recompute(); }));
    list.append(matRow(refined, 1, priceRefinedSell, v => { priceRefinedSell = v; recompute(); }, "Output sell price"));

    recompute();
  }

  function matRow(item, qty, price, onChange, labelOverride) {
    if (!item) return h("div");
    const name = item.names ? localName(item.names, lang, item.id) : item.id;
    return h("div", { class: "recipe-row" },
      h("img", { src: iconUrl(item.id, 1, 40) }),
      h("div", null,
        h("div", null, labelOverride || name),
        h("div", { class: "id" }, item.id)
      ),
      h("div", { class: "qty" }, `x ${qty}`),
      h("input", { type: "number", min: "0", value: price, oninput: e => onChange(+e.target.value) }),
      h("div", { class: "qty" }, h("span", { class: "silver" }, silver(price * qty)))
    );
  }

  function recompute() {
    if (!refined) return;
    const t = refined.tier || 2;
    const rawN = RAW_PER_REFINED[t] ?? 2;
    const prevN = PREV_REFINED_PER_REFINED[t] ?? 1;

    const rr = useFocus ? (getSetting("focusReturnRate") ?? 0.435) : (getSetting("returnRate") ?? 0.248);

    const matCostRaw = priceRaw * rawN + pricePrev * prevN;
    const matCostEff = matCostRaw * (1 - rr);

    const revInstant = priceRefinedBuy * (1 - 0.04);
    const revPatient = priceRefinedSell * (1 - 0.065);

    const profitInstant = revInstant - matCostEff;
    const profitPatient = revPatient - matCostEff;

    const marginInstant = matCostEff > 0 ? profitInstant / matCostEff : 0;
    const marginPatient = matCostEff > 0 ? profitPatient / matCostEff : 0;

    const out = detail.querySelector("#ref-out");
    if (!out) return;
    clear(out);
    out.append(
      cell("Raw mat cost", h("span", { class: "silver" }, silver(matCostRaw))),
      cell(`After ${(rr * 100).toFixed(1)}% return`, h("span", { class: "silver" }, silver(matCostEff))),
      cell(`Sell @ ${sellCity} (instant)`, h("span", { class: "silver" }, silver(revInstant))),
      cell(`Sell @ ${sellCity} (patient)`, h("span", { class: "silver" }, silver(revPatient))),
      cell("Profit instant", h("span", { class: profitInstant >= 0 ? "silver" : "" }, silver(profitInstant)), profitInstant >= 0 ? "pos" : "neg"),
      cell("Profit patient", h("span", { class: profitPatient >= 0 ? "silver" : "" }, silver(profitPatient)), profitPatient >= 0 ? "pos" : "neg"),
      cell("Margin instant", pct(marginInstant), marginInstant >= 0 ? "pos" : "neg"),
      cell("Margin patient", pct(marginPatient), marginPatient >= 0 ? "pos" : "neg"),
    );
  }
}

function wrapField(label, node) {
  return h("div", { class: "field" }, h("label", null, label), node);
}

function cell(label, value, cls = "") {
  return h("div", { class: "summary-cell" },
    h("div", { class: "label" }, label),
    h("div", { class: "value " + cls }, value)
  );
}
