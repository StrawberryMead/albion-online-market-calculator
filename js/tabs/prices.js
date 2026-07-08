// js/tabs/prices.js

import { h, clear, mount, toast } from "../utils/dom.js";
import { silver, num, relTime, iconUrl, localName } from "../utils/fmt.js";
import { itemSearch } from "./common.js";
import { getPrices, getHistory } from "../api.js";
import { renderLineChart } from "../utils/chart.js";
import { get as getSetting } from "../settings.js";

let stationsPromise;
async function stations() {
  if (!stationsPromise) {
    stationsPromise = fetch("data/stations.json").then(r => r.json());
  }
  return stationsPromise;
}

let currentItem = null;
let currentQualities = [1];
let currentWindow = "7d";  // "24h" | "7d" | "30d"
let currentScale = 24;     // 1 = hourly, 24 = daily

export async function render(host) {
  clear(host);

  const sta = await stations();
  const cityIds = sta.cities.map(c => c.id);

  const searchCard = h("div", { class: "card" },
    h("h2", null, "Item lookup"),
    h("div", { class: "hint" }, "Type at least 2 characters. Data comes from the Albion Online Data Project."),
    h("div", { style: "margin-top:8px;" })
  );
  const search = itemSearch((it) => { currentItem = it; renderDetail(); });
  searchCard.append(search.el);
  host.append(searchCard);

  const detail = h("div", { id: "prices-detail" });
  host.append(detail);

  function renderDetail() {
    clear(detail);
    if (!currentItem) return;

    const lang = getSetting("language") || "EN-US";

    // Qualities selector
    const qChips = h("div", { class: "chips" },
      ...[1, 2, 3, 4, 5].map(q => {
        const label = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"][q];
        const chip = h("span", {
          class: "chip" + (currentQualities.includes(q) ? " on" : ""),
          onclick: () => toggleQuality(q),
        }, `${q} ${label}`);
        return chip;
      })
    );

    // Window selector
    const wChips = h("div", { class: "chips" },
      ...[
        { id: "24h", label: "24h", scale: 1, days: 1 },
        { id: "7d",  label: "7d",  scale: 1, days: 7 },
        { id: "30d", label: "30d", scale: 24, days: 30 },
      ].map(w => h("span", {
        class: "chip" + (currentWindow === w.id ? " on" : ""),
        onclick: () => { currentWindow = w.id; currentScale = w.scale; refresh(); },
      }, w.label))
    );

    const scaleChips = h("div", { class: "chips" },
      ...[
        { id: 1,  label: "Hourly" },
        { id: 6,  label: "6h" },
        { id: 24, label: "Daily" },
      ].map(s => h("span", {
        class: "chip" + (currentScale === s.id ? " on" : ""),
        onclick: () => { currentScale = s.id; refresh(); },
      }, s.label))
    );

    const head = h("div", { class: "card" },
      h("div", { class: "item-detail-head" },
        h("img", { src: iconUrl(currentItem.id, 1, 64), alt: "" }),
        h("div", null,
          h("div", { class: "name" }, localName(currentItem.names, lang, currentItem.id)),
          h("div", { class: "id" }, `${currentItem.id}${currentItem.tier ? `  |  T${currentItem.tier}${currentItem.enchant ? "." + currentItem.enchant : ""}` : ""}`)
        )
      ),
      h("div", { class: "row" },
        h("div", { class: "col" },
          h("label", null, "Quality"),
          qChips
        ),
        h("div", { class: "col" },
          h("label", null, "Window"),
          wChips
        ),
        h("div", { class: "col" },
          h("label", null, "Scale"),
          scaleChips
        )
      )
    );
    detail.append(head);

    const pricesCard = h("div", { class: "card" },
      h("div", { class: "card-title-row" },
        h("h3", null, "Prices by city"),
        h("button", { class: "small", onclick: refresh }, "Refresh")
      ),
      h("div", { id: "prices-body" }, h("span", { class: "spinner" }), " loading...")
    );
    detail.append(pricesCard);

    const chartCard = h("div", { class: "card" },
      h("div", { class: "card-title-row" },
        h("h3", null, "Historical average price"),
        h("span", { class: "muted", id: "hist-hint" }, "")
      ),
      h("div", { id: "prices-chart", class: "chart" })
    );
    detail.append(chartCard);

    refresh();
  }

  function toggleQuality(q) {
    if (currentQualities.includes(q)) {
      currentQualities = currentQualities.filter(x => x !== q);
      if (currentQualities.length === 0) currentQualities = [1];
    } else {
      currentQualities = [...currentQualities, q].sort();
    }
    renderDetail();
  }

  async function refresh() {
    if (!currentItem) return;
    const cities = cityIds;
    const pricesBody = detail.querySelector("#prices-body");
    const chartHost = detail.querySelector("#prices-chart");
    const histHint = detail.querySelector("#hist-hint");

    pricesBody.textContent = "";
    pricesBody.append(h("span", { class: "spinner" }), " loading prices...");
    chartHost.innerHTML = "";

    try {
      const rows = await getPrices([currentItem.id], { locations: cities, qualities: currentQualities });
      renderPricesTable(pricesBody, rows);
    } catch (e) {
      pricesBody.textContent = "";
      pricesBody.append(h("div", { class: "error" }, "Failed to load prices: " + e.message));
    }

    const days = currentWindow === "24h" ? 1 : currentWindow === "7d" ? 7 : 30;
    try {
      histHint.textContent = "loading...";
      const hist = await getHistory([currentItem.id], {
        locations: cities,
        qualities: currentQualities,
        timeScale: currentScale,
        days,
      });
      const merged = mergeHistory(hist);
      renderLineChart(chartHost, merged);
      histHint.textContent = merged.length ? `${merged.length} points, scale ${currentScale}h, aggregated across selected cities/qualities` : "no history";
    } catch (e) {
      histHint.textContent = "";
      chartHost.innerHTML = "";
      chartHost.append(h("div", { class: "error", style: "padding:8px;" }, "Failed to load history: " + e.message));
    }
  }

  function renderPricesTable(host, rows) {
    clear(host);
    if (!rows || rows.length === 0) {
      host.append(h("div", { class: "muted" }, "No price data returned."));
      return;
    }
    // Group by city, quality
    rows.sort((a, b) => a.city.localeCompare(b.city) || a.quality - b.quality);
    const table = h("table", { class: "data" },
      h("thead", null, h("tr", null,
        h("th", null, "City"),
        h("th", { class: "num" }, "Q"),
        h("th", { class: "num" }, "Sell min"),
        h("th", null, "Sell updated"),
        h("th", { class: "num" }, "Buy max"),
        h("th", null, "Buy updated")
      )),
      h("tbody", null, ...rows.map(r => h("tr", null,
        h("td", null, r.city),
        h("td", { class: "num" }, r.quality),
        h("td", { class: "num" }, r.sell_price_min > 0 ? h("span", { class: "silver" }, silver(r.sell_price_min)) : "-"),
        h("td", { class: (isStale(r.sell_price_min_date) ? "stale" : "") }, r.sell_price_min > 0 ? relTime(r.sell_price_min_date) : "-"),
        h("td", { class: "num" }, r.buy_price_max > 0 ? h("span", { class: "silver" }, silver(r.buy_price_max)) : "-"),
        h("td", { class: (isStale(r.buy_price_max_date) ? "stale" : "") }, r.buy_price_max > 0 ? relTime(r.buy_price_max_date) : "-")
      )))
    );
    host.append(table);
  }
}

function isStale(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  return Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
}

// Merge history rows into a single time series (weighted average by item_count)
function mergeHistory(hist) {
  const bucket = new Map();
  for (const series of hist) {
    for (const p of (series.data || [])) {
      const t = +new Date(p.timestamp);
      const cur = bucket.get(t) || { count: 0, sum: 0 };
      const c = Math.max(1, p.item_count || 1);
      cur.count += c;
      cur.sum += (p.avg_price || 0) * c;
      bucket.set(t, cur);
    }
  }
  const points = [...bucket.entries()]
    .map(([t, v]) => ({ x: t, y: v.sum / v.count }))
    .sort((a, b) => a.x - b.x);
  return points;
}
