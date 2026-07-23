import { computeProfit, estimateRRR, effectiveOutput } from "../js/bonus-calculator.js";

function approx(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
let failed = 0;

// 1. Batch-aware output: equipment (b=1) at 0.152 RRR
{
  const out = effectiveOutput(1, 0.152);
  const expected = 1 / (1 - 0.152);
  if (!approx(out, expected)) { console.error("eq output mismatch", out, expected); failed++; }
  else console.log("OK equipment batch=1 output", out.toFixed(4));
}

// 2. Batch-aware output: potion (b=5) at focus 0.4785
{
  const out = effectiveOutput(5, 0.4785);
  const expected = 5 / (1 - 0.4785);
  if (!approx(out, expected)) { console.error("pot output mismatch", out, expected); failed++; }
  else console.log("OK potion batch=5 focus output", out.toFixed(4));
}

// 3. Batch-aware output: food (b=5) at 0.6785 (focus + city specialty +0.20)
{
  const out = effectiveOutput(5, 0.6785);
  const expected = 5 / (1 - 0.6785);
  if (!approx(out, expected)) { console.error("food output mismatch", out, expected); failed++; }
  else console.log("OK food batch=5 focus+city output", out.toFixed(4));
}

// 4. Profit sanity: 1 unit output batch=1
{
  const r = computeProfit({
    materials: [{ qty: 10, price: 100 }],
    batchSize: 1,
    sellPrice: 1500,
    craftingFeePerCraft: 100,
    rrr: 0,
    marketTax: 0,
    premium: false
  });
  if (!approx(r.outputPerCraft, 1)) { console.error("output"); failed++; }
  if (!approx(r.materialCostPerCraft, 1000)) { console.error("mat cost"); failed++; }
  if (!approx(r.totalCostPerCraft, 1100)) { console.error("total cost"); failed++; }
  if (!approx(r.revenuePerCraft, 1500)) { console.error("revenue"); failed++; }
  if (!approx(r.profitPerCraft, 400)) { console.error("profit"); failed++; }
  console.log("OK equipment profit", r);
}

// 5. Profit sanity: potion batch=5 with focus RRR
{
  const r = computeProfit({
    materials: [{ qty: 4, price: 200 }, { qty: 4, price: 100 }],
    batchSize: 5,
    sellPrice: 500,
    craftingFeePerCraft: 120,
    rrr: 0.4785,
    marketTax: 0.04,
    premium: true
  });
  const expectedOut = 5 / (1 - 0.4785);
  if (!approx(r.outputPerCraft, expectedOut)) { console.error("pot output"); failed++; }
  console.log("OK potion profit", { output: r.outputPerCraft.toFixed(2), profit: r.profitPerCraft.toFixed(0), unit: r.profitPerUnit.toFixed(2) });
}

// 6. RRR with city bonus
{
  const r = estimateRRR({ city: "Fort Sterling", category: "equipment", subCategory: "cloth", focus: true, useCraftingBonus: true });
  const expected = 0.4785 + 0.20;
  if (!approx(r, expected)) { console.error("rrr", r, expected); failed++; }
  else console.log("OK RRR Fort Sterling cloth focus", r.toFixed(4));
}

// 7. RRR without bonus
{
  const r = estimateRRR({ city: "Caerleon", category: "equipment", focus: false, useCraftingBonus: false });
  if (!approx(r, 0.152)) { console.error("rrr no-bonus", r); failed++; }
  else console.log("OK RRR base no-bonus", r);
}

if (failed) { console.error(`FAILED ${failed} check(s)`); process.exit(1); }
else console.log("ALL PASS");
