// js/tabs/transport.js
// Buy in city A, sell in city B: compute margin across all city pairs for a chosen item.

import { h, clear } from "../utils/dom.js";
import { silver, pct, relTime, iconUrl, localName } from "../utils/fmt.js";
import { itemSearch } from "./_common.js";
import { getPrices } from "../api.js";
import { get as getSetting } from "../settings.js";

let stationsPromise;
async function stations() {
  if (!stationsPromise) stationsPromise = fetch("data/stations.json").then(r => r.json());
  return stationsPromise;
}

let target = null;
let quality = 1;
let mode = "instant"; // "instant" = buy sell-order at source, sell buy-order at dest; "patient" = buy from buy orders (not modeled), skip

export async function render(host) {
  clear(host);
  const sta = await stations();
  const lang = getSetting("language") || "EN-US";

  const searchCard = h("div", { class: "card" },
    h("h2", null, "Transport / Flip"),
    h("div", { class: "hint" }, "Shows buy/sell across cities, ranked by margin (buy at source sell_price_min, sell at destination buy_price_max minus 4% market tax)."),
    h("div", { style: "margin-top:8px;" })
  );
  const search = itemSearch((it) => { target = it; renderDetail(); }, { placeholder: "Item to flip..." });
  const qSelect = h("div", { style: "margin-top:8px;" },
    h("label", { style: "margin-right:8px;" }, "Quality:"),
    h("select", { onchange: e => { quality = +e.target.value; renderDetail(); } },
      ...[1,2,3,4,5].map(q => h("option", { value: q, selected: quality === q ? "" : null }, `Q${q}`))
    )
  );
  searchCard.append(search.el, qSelect);
  host.append(searchCard);

  const detail = h("div");
  host.append(detail);

  async function renderDetail() {
    clear(detail);
    if (!target) return;

    const head = h("div", { class: "card" },
      h("div", { class: "item-detail-head" },
        h("img", { src: iconUrl(target.id, quality, 64) }),
        h("div", null,
          h("div", { class: "name" }, localName(target.names, lang, target.id)),
          h("div", { class: "id" }, `${target.id}  |  Q${quality}`)
        )
      ),
      h("div", { class: "card-title-row" },
        h("h3", null, "Best flips"),
        h("button", { class: "small", onclick: refresh }, "Refresh")
      ),
      h("div", { id: "flip-table" }, h("span", { class: "spinner" }), " loading...")
    );
    detail.append(head);

    await refresh();
  }

  async function refresh() {
    const cities = (await stations()).cities.map(c => c.id);
    const host = detail.querySelector("#flip-table");
    host.innerHTML = "";
    host.append(h("span", { class: "spinner" }), " loading prices...");
    try {
      const rows = await getPrices([target.id], { locations: cities, qualities: [quality] });
      renderFlipTable(host, rows, cities);
    } catch (e) {
      host.innerHTML = "";
      host.append(h("div", { class: "error" }, "Failed to load prices: " + e.message));
    }
  }

  function renderFlipTable(host, rows, cities) {
    clear(host);
    if (!rows || rows.length === 0) {
      host.append(h("div", { class: "muted" }, "No data returned."));
      return;
    }
    const byCity = new Map();
    for (const r of rows) byCity.set(r.city, r);

    const pairs = [];
    for (const src of cities) for (const dst of cities) {
      if (src === dst) continue;
      const a = byCity.get(src);
      const b = byCity.get(dst);
      if (!a || !b) continue;
      const buy = a.sell_price_min;
      const sell = b.buy_price_max;
      if (buy <= 0 || sell <= 0) continue;
      const rev = sell * (1 - 0.04);
      const profit = rev - buy;
      const margin = buy > 0 ? profit / buy : 0;
      pairs.push({ src, dst, buy, sell, profit, margin, srcDate: a.sell_price_min_date, dstDate: b.buy_price_max_date });
    }
    pairs.sort((a, b) => b.margin - a.margin);

    const table = h("table", { class: "data" },
      h("thead", null, h("tr", null,
        h("th", null, "Buy at"),
        h("th", { class: "num" }, "Sell min"),
        h("th", null, "Updated"),
        h("th", null, "Sell at"),
        h("th", { class: "num" }, "Buy max"),
        h("th", null, "Updated"),
        h("th", { class: "num" }, "Net revenue"),
        h("th", { class: "num" }, "Profit"),
        h("th", { class: "num" }, "Margin")
      )),
      h("tbody", null, ...pairs.slice(0, 40).map(p => h("tr", null,
        h("td", null, p.src),
        h("td", { class: "num" }, h("span", { class: "silver" }, silver(p.buy))),
        h("td", { class: isStale(p.srcDate) ? "stale" : "" }, relTime(p.srcDate)),
        h("td", null, p.dst),
        h("td", { class: "num" }, h("span", { class: "silver" }, silver(p.sell))),
        h("td", { class: isStale(p.dstDate) ? "stale" : "" }, relTime(p.dstDate)),
        h("td", { class: "num" }, h("span", { class: "silver" }, silver(p.sell * (1 - 0.04)))),
        h("td", { class: "num " + (p.profit >= 0 ? "pos" : "neg") }, silver(p.profit)),
        h("td", { class: "num " + (p.margin >= 0 ? "pos" : "neg") }, pct(p.margin))
      )))
    );
    host.append(table);

    if (pairs.length === 0) {
      host.append(h("div", { class: "muted", style: "margin-top:8px;" }, "No profitable pairs (or missing data)."));
    }
  }
}

function isStale(dateStr) {
  if (!dateStr) return true;
  return Date.now() - new Date(dateStr).getTime() > 24 * 60 * 60 * 1000;
}
