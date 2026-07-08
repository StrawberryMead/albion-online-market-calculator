// js/tabs/_common.js
// Shared helpers for tab UIs.

import { h, clear, toast } from "../utils/dom.js";
import { iconUrl, localName } from "../utils/fmt.js";
import * as Items from "../items.js";
import { get as getSetting } from "../settings.js";
import { debounce } from "../utils/debounce.js";

// Item search combobox. onPick(item) callback.
export function itemSearch(onPick, opts = {}) {
  const placeholder = opts.placeholder || "Search item...";
  const input = h("input", {
    type: "search",
    placeholder,
    autocomplete: "off",
    spellcheck: "false",
    style: "width:100%;",
  });
  const results = h("div", { class: "search-results hidden" });
  const wrap = h("div", { class: "search-wrap" }, input, results);

  let hoverIdx = -1;
  let list = [];

  const lang = () => getSetting("language") || "EN-US";

  function render() {
    clear(results);
    if (list.length === 0) {
      results.classList.add("hidden");
      return;
    }
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const row = h("div", {
        class: "search-item" + (i === hoverIdx ? " hover" : ""),
        onclick: () => choose(i),
        onmouseenter: () => { hoverIdx = i; updateHover(); },
      },
        h("img", { src: iconUrl(it.id, 1, 40), alt: "", loading: "lazy" }),
        h("div", null,
          h("div", { class: "name" }, localName(it.names, lang(), it.id)),
          h("div", null,
            h("span", { class: "id" }, it.id),
            it.tier > 0 ? h("span", { class: "tier", style: "margin-left:6px;" }, `T${it.tier}${it.enchant ? "." + it.enchant : ""}`) : null
          )
        )
      );
      results.append(row);
    }
    results.classList.remove("hidden");
  }

  function updateHover() {
    [...results.children].forEach((c, i) => c.classList.toggle("hover", i === hoverIdx));
    const el = results.children[hoverIdx];
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  function choose(i) {
    const it = list[i];
    if (!it) return;
    input.value = localName(it.names, lang(), it.id);
    results.classList.add("hidden");
    onPick(it);
  }

  const doSearch = debounce(() => {
    const q = input.value.trim();
    if (q.length < 2) { list = []; render(); return; }
    list = Items.search(q, { limit: 30 });
    hoverIdx = list.length ? 0 : -1;
    render();
  }, 120);

  input.addEventListener("input", doSearch);
  input.addEventListener("focus", () => { if (list.length) results.classList.remove("hidden"); });
  input.addEventListener("blur", () => setTimeout(() => results.classList.add("hidden"), 150));
  input.addEventListener("keydown", (e) => {
    if (results.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") { hoverIdx = Math.min(list.length - 1, hoverIdx + 1); updateHover(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { hoverIdx = Math.max(0, hoverIdx - 1); updateHover(); e.preventDefault(); }
    else if (e.key === "Enter" && hoverIdx >= 0) { choose(hoverIdx); e.preventDefault(); }
    else if (e.key === "Escape") { results.classList.add("hidden"); }
  });

  return { el: wrap, input, focus: () => input.focus(), setValue: (v) => { input.value = v; } };
}

// Best-of aggregation across price rows
export function bestOf(priceRows) {
  // priceRows: array of AODP rows.
  // Return best sell (lowest sell_price_min) and best buy (highest buy_price_max)
  let bestSell = null, bestBuy = null;
  for (const r of priceRows) {
    if (r.sell_price_min > 0 && (!bestSell || r.sell_price_min < bestSell.sell_price_min)) bestSell = r;
    if (r.buy_price_max > 0 && (!bestBuy || r.buy_price_max > bestBuy.buy_price_max)) bestBuy = r;
  }
  return { bestSell, bestBuy };
}

export { toast };
