// js/utils/dom.js
// Minimal DOM builder helper.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs) && !(attrs instanceof Node)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class" || k === "className") {
        el.className = v;
      } else if (k === "style" && typeof v === "object") {
        Object.assign(el.style, v);
      } else if (k === "dataset" && typeof v === "object") {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      } else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "html") {
        el.innerHTML = v;
      } else if (v === true) {
        el.setAttribute(k, "");
      } else {
        el.setAttribute(k, v);
      }
    }
  } else if (attrs != null) {
    children.unshift(attrs);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(host, node) {
  clear(host);
  host.append(node);
  return node;
}

export function toast(msg, type = "info", ttl = 3500) {
  const host = document.getElementById("toast-host");
  if (!host) return;
  const el = h("div", { class: `toast ${type}` }, msg);
  host.append(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, ttl);
}
