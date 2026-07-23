import { el, clear, toast } from "../utils/dom.js";
import { Settings } from "../settings.js";
import { clearPriceCache } from "../api.js";
import { CITIES } from "../bonus-calculator.js";

export function mount(root) {
  clear(root);

  const serverSelect = el("select");
  for (const [id, label] of [["america","America (West)"],["europe","Europe"],["asia","Asia (East)"]]) {
    serverSelect.appendChild(el("option", { value: id, selected: id === Settings.get("server") }, [label]));
  }

  const languageSelect = el("select");
  for (const l of ["EN-US","DE-DE","FR-FR","ES-ES","PL-PL","PT-BR","RU-RU","ZH-CN","KO-KR","JA-JP"]) {
    languageSelect.appendChild(el("option", { value: l, selected: l === Settings.get("language") }, [l]));
  }

  const citySelect = el("select");
  for (const c of CITIES) citySelect.appendChild(el("option", { value: c, selected: c === Settings.get("city") }, [c]));

  const premiumBox = el("input", { type: "checkbox", checked: Settings.get("premium") });
  const focusBox   = el("input", { type: "checkbox", checked: Settings.get("focus") });
  const cityBonusBox = el("input", { type: "checkbox", checked: Settings.get("useCraftingBonus") });

  const taxPremium = el("input", { type: "number", step: "0.01", min: "0", max: "1", value: String(Settings.get("marketTaxPremium")) });
  const taxNonPremium = el("input", { type: "number", step: "0.01", min: "0", max: "1", value: String(Settings.get("marketTaxNonPremium")) });
  const cacheTtl = el("input", { type: "number", min: "1", step: "1", value: String(Settings.get("cacheTtlMinutes")) });
  const clearCacheBtn = el("button", {}, ["Clear price cache"]);
  const resetBtn = el("button", {}, ["Reset to defaults"]);
  const saveBtn = el("button", { class: "primary" }, ["Save"]);

  root.appendChild(el("div", { class: "grid two" }, [
    el("div", { class: "card" }, [
      el("h3", {}, ["Server & Localization"]),
      el("div", { class: "field" }, [el("label", {}, ["Server"]), serverSelect]),
      el("div", { class: "field" }, [el("label", {}, ["Language"]), languageSelect]),
      el("p", { class: "hint" }, ["Server picks the AODP subdomain (west/europe/east)."])
    ]),
    el("div", { class: "card" }, [
      el("h3", {}, ["Default Bonuses"]),
      el("label", { class: "check" }, [premiumBox, " Premium (fee -50%)"]),
      el("label", { class: "check" }, [focusBox, " Focus"]),
      el("label", { class: "check" }, [cityBonusBox, " Apply city specialty bonus"]),
      el("div", { class: "field" }, [el("label", {}, ["Default City"]), citySelect])
    ]),
    el("div", { class: "card" }, [
      el("h3", {}, ["Market Tax"]),
      el("div", { class: "field" }, [el("label", {}, ["Premium market tax (0-1)"]), taxPremium]),
      el("div", { class: "field" }, [el("label", {}, ["Non-premium market tax (0-1)"]), taxNonPremium])
    ]),
    el("div", { class: "card" }, [
      el("h3", {}, ["Cache"]),
      el("div", { class: "field" }, [el("label", {}, ["Cache TTL (minutes)"]), cacheTtl]),
      el("div", { class: "row" }, [clearCacheBtn])
    ]),
    el("div", { class: "card" }, [
      el("h3", {}, ["Actions"]),
      el("div", { class: "row" }, [saveBtn, resetBtn])
    ])
  ]));

  saveBtn.addEventListener("click", () => {
    Settings.update({
      server: serverSelect.value,
      language: languageSelect.value,
      premium: premiumBox.checked,
      focus: focusBox.checked,
      city: citySelect.value,
      useCraftingBonus: cityBonusBox.checked,
      marketTaxPremium: Number(taxPremium.value),
      marketTaxNonPremium: Number(taxNonPremium.value),
      cacheTtlMinutes: Number(cacheTtl.value)
    });
    const badge = document.getElementById("server-badge");
    if (badge) badge.textContent = ({ america: "America", europe: "Europe", asia: "Asia" }[serverSelect.value]) || serverSelect.value;
    toast("Settings saved", "success");
  });

  resetBtn.addEventListener("click", () => {
    Settings.update(Settings.defaults());
    toast("Restored defaults - reload for full effect", "info");
  });

  clearCacheBtn.addEventListener("click", () => {
    clearPriceCache();
    toast("Price cache cleared", "success");
  });
}
