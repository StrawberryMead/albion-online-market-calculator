import { el, clear, toast } from "../utils/dom.js";
import { fmtSilver, fmtPct, fmtNum, timeAgo } from "../utils/fmt.js";
import { debounce } from "../utils/debounce.js";
import { loadCatalog, findItems } from "../data-loader.js";
import { buildRecipeView, autofillPrices, computeView } from "../craft-engine.js";
import { CITIES } from "../bonus-calculator.js";
import { Settings } from "../settings.js";

const CATEGORY_META = {
  equipment: {
    title: "Equipment",
    subtitle: "Weapons, armor, offhands, capes, tools",
    batchNote: "Equipment crafts one item per craft (batch = 1)."
  },
  potions: {
    title: "Potions",
    subtitle: "Alchemy consumables",
    batchNote: "Potion recipes typically produce a batch of 5 per craft."
  },
  foods: {
    title: "Foods",
    subtitle: "Cooked meals and dishes",
    batchNote: "Cooking recipes typically produce a batch of 5 per craft."
  }
};

export async function mountCraftingTab(root, category) {
  const meta = CATEGORY_META[category] || { title: category, subtitle: "", batchNote: "" };

  clear(root);

  const state = {
    view: null,
    catalog: null,
    filter: ""
  };

  const searchInput = el("input", {
    type: "search",
    placeholder: `Search ${meta.title.toLowerCase()}... (e.g. T5, potion, plate)`,
    autocomplete: "off"
  });
  const searchList = el("div", { class: "search-list" });

  const premiumBox = el("input", { type: "checkbox", checked: Settings.get("premium") });
  const focusBox   = el("input", { type: "checkbox", checked: Settings.get("focus") });
  const cityBonusBox = el("input", { type: "checkbox", checked: Settings.get("useCraftingBonus") });

  const citySelect = el("select");
  for (const c of CITIES) {
    citySelect.appendChild(el("option", { value: c, selected: c === Settings.get("city") }, [c]));
  }

  const qualitySelect = el("select");
  for (const [q, label] of [[1,"Normal"],[2,"Good"],[3,"Outstanding"],[4,"Excellent"],[5,"Masterpiece"]]) {
    qualitySelect.appendChild(el("option", { value: String(q), selected: q === Settings.get("qualityDefault") }, [label]));
  }

  const feeInput = el("input", { type: "number", min: "0", step: "1", value: "0", class: "mat-price-input" });
  const sellInput = el("input", { type: "number", min: "0", step: "1", value: "0", class: "mat-price-input" });
  const autofillBtn = el("button", { class: "primary" }, ["Fetch Market"]);

  const recipeHost = el("div");
  const metricsHost = el("div", { class: "metrics-row" });
  const batchPill = el("span", { class: "batch-pill" }, ["Batch: -"]);
  const itemName = el("h3", {}, [meta.title]);

  const controlsCard = el("div", { class: "card" }, [
    el("h3", {}, ["Bonuses"]),
    el("div", { class: "row" }, [
      el("label", { class: "check" }, [premiumBox, " Premium (fee -50%)"]),
      el("label", { class: "check" }, [focusBox, " Focus"]),
      el("label", { class: "check" }, [cityBonusBox, " Apply city specialty bonus"])
    ]),
    el("div", { class: "row", style: { marginTop: "10px" } }, [
      el("div", { class: "field" }, [el("label", {}, ["City"]), citySelect]),
      el("div", { class: "field" }, [el("label", {}, ["Sell quality"]), qualitySelect]),
      el("div", { class: "field" }, [el("label", {}, ["Crafting fee /craft"]), feeInput]),
      el("div", { class: "field" }, [el("label", {}, ["Sell price"]), sellInput]),
      el("div", { class: "field" }, [el("label", {}, [" "]), autofillBtn])
    ]),
    el("p", { class: "hint" }, [meta.batchNote])
  ]);

  root.appendChild(el("div", { class: "grid side" }, [
    el("div", {}, [
      el("div", { class: "card" }, [
        el("h3", {}, [`Choose ${meta.title}`]),
        el("p", { class: "hint" }, [meta.subtitle]),
        searchInput,
        searchList
      ])
    ]),
    el("div", {}, [
      el("div", { class: "card" }, [
        el("div", { class: "row", style: { justifyContent: "space-between" } }, [itemName, batchPill]),
        recipeHost,
        el("div", { class: "divider" }),
        metricsHost
      ]),
      controlsCard
    ])
  ]));

  state.catalog = await loadCatalog().catch((err) => {
    toast(`Catalog load failed: ${err.message}`, "error");
    return null;
  });

  const renderSearch = () => {
    clear(searchList);
    if (!state.catalog) {
      searchList.appendChild(el("div", { class: "empty" }, ["Catalog unavailable."]));
      return;
    }
    const list = findItems(state.catalog, category, state.filter);
    if (!list.length) {
      searchList.appendChild(el("div", { class: "empty" }, ["No matches."]));
      return;
    }
    for (const it of list.slice(0, 120)) {
      searchList.appendChild(el("div", {
        class: "search-item",
        onClick: () => selectItem(it.id)
      }, [
        el("span", {}, [`T${it.tier} ${it.name}${it.enchant ? ` @${it.enchant}` : ""}`]),
        " ",
        el("span", { class: "tag" }, [it.id])
      ]));
    }
  };

  const renderRecipe = () => {
    clear(recipeHost);
    if (!state.view) {
      recipeHost.appendChild(el("div", { class: "empty" }, ["Select an item to see its recipe."]));
      batchPill.textContent = "Batch: -";
      itemName.textContent = meta.title;
      return;
    }
    const v = state.view;
    itemName.textContent = `${v.item.name}  (T${v.item.tier}${v.item.enchant ? `.${v.item.enchant}` : ""})`;
    batchPill.textContent = `Batch: ${v.batchSize} per craft`;

    const table = el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", {}, ["Material"]),
        el("th", { class: "num" }, ["Qty"]),
        el("th", { class: "num" }, ["Unit price"]),
        el("th", { class: "num" }, ["Subtotal"]),
        el("th", {}, ["Source"])
      ])])
    ]);
    const tbody = el("tbody");
    for (const m of v.materials) {
      const priceInput = el("input", {
        type: "number", min: "0", step: "1",
        value: String(m.price || 0),
        class: "mat-price-input"
      });
      priceInput.addEventListener("input", () => {
        m.price = Number(priceInput.value) || 0;
        m.priceSource = "manual";
        recalc();
        subtotalCell.textContent = fmtSilver(m.price * m.qty);
      });
      const subtotalCell = el("td", { class: "num" }, [fmtSilver(m.price * m.qty)]);
      tbody.appendChild(el("tr", {}, [
        el("td", {}, [`T${m.tier} ${m.name}`, " ", el("span", { class: "tag" }, [m.id])]),
        el("td", { class: "num qty-cell" }, [String(m.qty)]),
        el("td", { class: "num" }, [priceInput]),
        subtotalCell,
        el("td", {}, [
          el("span", { class: "tag" }, [m.priceSource]),
          m.priceUpdated ? el("div", { class: "hint" }, [timeAgo(m.priceUpdated)]) : ""
        ])
      ]));
    }
    table.appendChild(tbody);
    recipeHost.appendChild(table);
  };

  const renderMetrics = () => {
    clear(metricsHost);
    if (!state.view) return;
    const r = computeView(state.view);
    const metrics = [
      { label: "Effective RRR", value: fmtPct(r.rrr), tone: "mut" },
      { label: "Output/craft", value: `${fmtNum(r.outputPerCraft, 2)} units`, tone: "mut" },
      { label: "Material cost/craft", value: fmtSilver(r.materialCostPerCraft), tone: "mut" },
      { label: "Total cost/craft", value: fmtSilver(r.totalCostPerCraft), tone: "mut" },
      { label: "Revenue/craft (after tax)", value: fmtSilver(r.revenuePerCraft), tone: "mut" },
      { label: "Profit /craft", value: fmtSilver(r.profitPerCraft), tone: r.profitPerCraft >= 0 ? "pos" : "neg" },
      { label: "Profit /unit", value: fmtSilver(r.profitPerUnit), tone: r.profitPerUnit >= 0 ? "pos" : "neg" },
      { label: "Break-even sell", value: fmtSilver(r.breakEvenUnitPrice), tone: "mut" }
    ];
    for (const m of metrics) {
      metricsHost.appendChild(el("div", { class: "metric" }, [
        el("div", { class: "metric-label" }, [m.label]),
        el("div", { class: `metric-value ${m.tone}` }, [m.value])
      ]));
    }
  };

  const recalc = () => {
    if (!state.view) return;
    state.view.craftingFee = Number(feeInput.value) || 0;
    state.view.sellPrice = Number(sellInput.value) || 0;
    Settings.update({
      premium: premiumBox.checked,
      focus: focusBox.checked,
      city: citySelect.value,
      useCraftingBonus: cityBonusBox.checked,
      qualityDefault: Number(qualitySelect.value)
    });
    renderMetrics();
  };

  const selectItem = async (id) => {
    try {
      state.view = await buildRecipeView(state.catalog, id);
      feeInput.value = String(state.view.craftingFee || 0);
      sellInput.value = String(state.view.sellPrice || 0);
      renderRecipe();
      recalc();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  searchInput.addEventListener("input", debounce(() => {
    state.filter = searchInput.value.trim();
    renderSearch();
  }, 150));

  for (const c of [premiumBox, focusBox, cityBonusBox]) c.addEventListener("change", recalc);
  citySelect.addEventListener("change", recalc);
  qualitySelect.addEventListener("change", recalc);
  feeInput.addEventListener("input", recalc);
  sellInput.addEventListener("input", () => {
    if (state.view) state.view.sellPrice = Number(sellInput.value) || 0;
    renderMetrics();
  });

  autofillBtn.addEventListener("click", async () => {
    if (!state.view) return toast("Choose an item first", "error");
    autofillBtn.disabled = true;
    autofillBtn.textContent = "Fetching...";
    try {
      await autofillPrices(state.view, {
        city: citySelect.value,
        quality: Number(qualitySelect.value)
      });
      feeInput.value = String(state.view.craftingFee || 0);
      sellInput.value = String(state.view.sellPrice || 0);
      renderRecipe();
      recalc();
      toast("Market prices updated", "success");
    } catch (err) {
      toast(`Fetch failed: ${err.message}`, "error");
    } finally {
      autofillBtn.disabled = false;
      autofillBtn.textContent = "Fetch Market";
    }
  });

  renderSearch();
  renderRecipe();
}
