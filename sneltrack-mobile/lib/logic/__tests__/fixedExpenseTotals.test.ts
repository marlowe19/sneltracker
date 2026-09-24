// lib/logic/__tests__/fixedExpenseTotals.test.ts
// Ported from sneltrack/tests/fixedExpenseTotals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { toMonthlyPrice, sumFixedExpensesByCategory } from "../finance/fixedExpenseTotals.ts";

test("toMonthlyPrice normalizes period to a monthly amount", () => {
  assert.equal(toMonthlyPrice(1200, "year"), 100);
  assert.equal(toMonthlyPrice(300, "quarter"), 100);
});

test("sumFixedExpensesByCategory splits business vs private", () => {
  const totals = sumFixedExpensesByCategory([
    { price: 500, period: "month", category: "business" },
    { price: 1200, period: "year", category: "private" },
    { price: 200, period: "month" },
  ]);

  assert.equal(totals.businessMonthly, 700);
  assert.equal(totals.privateMonthly, 100);
});
