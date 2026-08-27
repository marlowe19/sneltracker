// lib/logic/__tests__/monthFinance.test.ts
// Ported from sneltrack/tests/monthFinance.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { computeMonthFinance, computeNetAfterTax, computeTaxReserve } from "../finance/monthFinance.ts";

test("monthFinance: waterfall from earnings to free-to-spend", () => {
  const r = computeMonthFinance({
    earnings: 3000,
    businessCostsMonthly: 500,
    privateCostsMonthly: 1200,
    taxReservePct: 35,
  });
  assert.equal(r.profit, 2500);
  assert.equal(r.taxReserve, 875);
  assert.equal(r.netAfterTax, 1625);
  assert.equal(r.freeToSpend, 425);
  assert.equal(r.expensePercentage, 17);
});

test("monthFinance: negative profit means no tax reserve", () => {
  const r = computeMonthFinance({
    earnings: 400,
    businessCostsMonthly: 800,
    privateCostsMonthly: 0,
    taxReservePct: 35,
  });
  assert.equal(r.profit, -400);
  assert.equal(r.taxReserve, 0);
  assert.equal(r.netAfterTax, -400);
  assert.equal(r.freeToSpend, -400);
});

test("monthFinance: tax reserve and net helpers", () => {
  assert.equal(computeTaxReserve(-100, 35), 0);
  assert.equal(computeNetAfterTax(2000, 500, 35), 975);
});
