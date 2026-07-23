import { el, clear, toast } from "../utils/dom.js";
import { fmtSilver, timeAgo } from "../utils/fmt.js";
import { debounce } from "../utils/debounce.js";
import { loadCatalog } from "../data-loader.js";
import { fetchPrices, CITIES } from "../api.js";
import { Settings } from "../settings.js";

export async function mount(root) {
  clear(root);

  const searchInput = el("input", { type: "search", placeholder: "Search any item by name or unique id..." });
  const qualitySelect = el("select");
  for (const [q, label] of [[1,"Normal"],[2,"Good"],[3,"Outstanding"],[4,"Excellent"],[5,"Masterpiece"]]) {
    qualitySelect.appendChild(el("option", { value: String(q), selected: q === Settings.get("qualityDefault") }, [label]));
  }
  const goBtn = el("button", { class: "primary" }, ["Fetch"]);
  const resultsHost = el("div");
  const searchList = el("div", { class: "search-list" });
  const state = { catalog: null, selected: null };

  root.appendChild(el("div", { class: "grid side" }, [
    el("div", {}, [
      el("div", { class: "card" }, [
        el("h3", {}, ["Find Item"]),
        searchInput,
        searchList
      ])
    ]),
    el("div", {}, [
      el("div", { class: "card" }, [
        el("h3", {}, ["Market Prices"]),
        el("div", { class: "row" }, [
          el("div", { class: "field" }, [el("label", {}, ["Quality"]), qualitySelect]),
          el("div", { class: "field" }, [el("label", {}, [" "]), goBtn])
        ]),
        el("p", { class: "hint" }, ["Server: ", el("span", { class: "tag" }, [Settings.get("server").toUpperCase()])]),
        resultsHost
      ])
    ])
  ]));

  state.catalog = await loadCatalog().catch(() => null);

  const renderSearch = () => {
    clear(searchList);
    if (!state.catalog) return searchList.appendChild(el("div", { class: "empty" }, ["Catalog unavailable."]));
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return searchList.appendChild(el("div", { class: "empty" }, ["Type to search..."]));
    const results = [];
    for (const it of state.catalog.items) {
      if (it.id.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)) results.push(it);
      if (results.length >= 150) break;
    }
    if (!results.length) return searchList.appendChild(el("div", { class: "empty" }, ["No matches."]));
    for (const it of results) {
      searchList.appendChild(el("div", {
        class: "search-item",
        onClick: () => { state.selected = it; searchInput.value = it.name; renderSearch(); doFetch(); }
      }, [
        el("span", {}, [`T${it.tier} ${it.name}${it.enchant ? ` @${it.enchant}` : ""}`]),
        " ",
        el("span", { class: "tag" }, [it.id])
      ]));
    }
  };

  const doFetch = async () => {
    if (!state.selected) return toast("Select an item first", "error");
    clear(resultsHost);
    resultsHost.appendChild(el("div", { class: "row" }, [el("span", { class: "spinner" }), " Fetching..."]));
    try {
      const quality = Number(qualitySelect.value) || 1;
      const rows = await fetchPrices(state.selected.id, {
        locations: CITIES,
        qualities: [quality]
      });
      renderRows(rows, quality);
    } catch (err) {
      clear(resultsHost);
      resultsHost.appendChild(el("div", { class: "empty" }, [`Fetch failed: ${err.message}`]));
    }
  };

  const renderRows = (rows, quality) => {
    clear(resultsHost);
    if (!rows || !rows.length) return resultsHost.appendChild(el("div", { class: "empty" }, ["No data returned."]));
    const table = el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", {}, ["City"]),
        el("th", { class: "num" }, ["Sell min"]),
        el("th", { class: "num" }, ["Sell max"]),
        el("th", { class: "num" }, ["Buy min"]),
        el("th", { class: "num" }, ["Buy max"]),
        el("th", {}, ["Updated"])
      ])])
    ]);
    const tbody = el("tbody");
    for (const r of rows) {
      if (Number(r.quality) !== Number(quality)) continue;
      tbody.appendChild(el("tr", {}, [
        el("td", {}, [r.city]),
        el("td", { class: "num" }, [fmtSilver(r.sell_price_min)]),
        el("td", { class: "num" }, [fmtSilver(r.sell_price_max)]),
        el("td", { class: "num" }, [fmtSilver(r.buy_price_max)]),
        el("td", { class: "num" }, [fmtSilver(r.buy_price_min)]),
        el("td", { class: "hint" }, [timeAgo(r.sell_price_min_date || r.buy_price_max_date)])
      ]));
    }
    table.appendChild(tbody);
    resultsHost.appendChild(table);
  };

  searchInput.addEventListener("input", debounce(renderSearch, 150));
  goBtn.addEventListener("click", doFetch);
  qualitySelect.addEventListener("change", () => {
    Settings.update({ qualityDefault: Number(qualitySelect.value) });
  });

  renderSearch();
}
