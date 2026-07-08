// js/utils/chart.js
// Tiny SVG line-chart renderer with hover tooltip.
// Input: [{ x: Date|number, y: number }], with monotonic x.

const NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k) el.append(k);
  return el;
}

export function renderLineChart(container, data, opts = {}) {
  container.innerHTML = "";
  container.classList.add("chart");
  if (!data || data.length === 0) {
    container.append(Object.assign(document.createElement("div"), {
      className: "muted",
      textContent: "No data",
      style: "padding:12px;font-size:12px;",
    }));
    return;
  }

  const W = container.clientWidth || 600;
  const H = container.clientHeight || 220;
  const padL = 44, padR = 12, padT = 10, padB = 22;
  const iw = W - padL - padR;
  const ih = H - padT - padB;

  const xs = data.map(d => +d.x);
  const ys = data.map(d => +d.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const yPad = (ymax - ymin) * 0.1 || Math.max(1, ymax * 0.1);
  const y0 = Math.max(0, ymin - yPad);
  const y1 = ymax + yPad;

  const xr = xmax === xmin ? 1 : (xmax - xmin);
  const yr = y1 === y0 ? 1 : (y1 - y0);

  const X = (v) => padL + ((v - xmin) / xr) * iw;
  const Y = (v) => padT + ih - ((v - y0) / yr) * ih;

  const pts = data.map(d => [X(+d.x), Y(+d.y)]);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaPath = path + ` L${pts[pts.length - 1][0].toFixed(1)},${(padT + ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT + ih).toFixed(1)} Z`;

  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => y0 + (yr * i / yTicks));
  const yTickEls = yTickVals.map(v => {
    const yy = Y(v);
    return [
      svg("line", { x1: padL, x2: W - padR, y1: yy, y2: yy, stroke: "rgba(255,255,255,0.05)" }),
      svg("text", { x: padL - 6, y: yy + 3, "text-anchor": "end" }, fmtNum(v)),
    ];
  }).flat();

  const xTicks = Math.min(6, data.length);
  const xTickEls = [];
  for (let i = 0; i < xTicks; i++) {
    const t = xmin + (xr * i / (xTicks - 1 || 1));
    const xx = X(t);
    xTickEls.push(svg("text", { x: xx, y: H - 6, "text-anchor": "middle" }, fmtDate(t)));
  }

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" },
    svg("g", { class: "axis" }, yTickEls, xTickEls),
    svg("path", { class: "area", d: areaPath }),
    svg("path", { class: "series", d: path })
  );

  // Hover
  const hoverLine = svg("line", { class: "hover-line", y1: padT, y2: padT + ih, x1: -10, x2: -10, visibility: "hidden" });
  const hoverDot = svg("circle", { class: "dot", r: 3.5, cx: -10, cy: -10, visibility: "hidden" });
  const tipBg = svg("rect", { class: "tooltip", rx: 3, ry: 3, width: 130, height: 32, visibility: "hidden" });
  const tipText1 = svg("text", { class: "tooltip-text", x: 0, y: 0, visibility: "hidden" });
  const tipText2 = svg("text", { class: "tooltip-text", x: 0, y: 0, visibility: "hidden" });
  root.append(hoverLine, hoverDot, tipBg, tipText1, tipText2);

  root.addEventListener("mousemove", (e) => {
    const rect = root.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    // Find nearest by x
    let iBest = 0, dBest = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i][0] - px);
      if (d < dBest) { dBest = d; iBest = i; }
    }
    const [cx, cy] = pts[iBest];
    hoverLine.setAttribute("x1", cx);
    hoverLine.setAttribute("x2", cx);
    hoverLine.setAttribute("visibility", "visible");
    hoverDot.setAttribute("cx", cx);
    hoverDot.setAttribute("cy", cy);
    hoverDot.setAttribute("visibility", "visible");
    const tipW = 130, tipH = 32;
    let tipX = cx + 8;
    if (tipX + tipW > W - padR) tipX = cx - tipW - 8;
    const tipY = Math.max(padT, cy - tipH - 6);
    tipBg.setAttribute("x", tipX);
    tipBg.setAttribute("y", tipY);
    tipBg.setAttribute("visibility", "visible");
    tipText1.textContent = fmtDate(xs[iBest], true);
    tipText2.textContent = fmtNum(ys[iBest]) + " silver";
    tipText1.setAttribute("x", tipX + 6);
    tipText1.setAttribute("y", tipY + 13);
    tipText2.setAttribute("x", tipX + 6);
    tipText2.setAttribute("y", tipY + 26);
    tipText1.setAttribute("visibility", "visible");
    tipText2.setAttribute("visibility", "visible");
  });
  root.addEventListener("mouseleave", () => {
    hoverLine.setAttribute("visibility", "hidden");
    hoverDot.setAttribute("visibility", "hidden");
    tipBg.setAttribute("visibility", "hidden");
    tipText1.setAttribute("visibility", "hidden");
    tipText2.setAttribute("visibility", "hidden");
  });

  container.append(root);
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return Math.round(n).toString();
}

function fmtDate(v, withTime = false) {
  const d = new Date(+v);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (!withTime) return `${mm}/${dd}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
