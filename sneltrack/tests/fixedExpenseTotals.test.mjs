import assert from "node:assert/strict";
import {
  toMonthlyPrice,
  sumFixedExpensesByCategory,
} from "../lib/finance/fixedExpenseTotals.js";

function runTests() {
  assert.equal(toMonthlyPrice(1200, "year"), 100);
  assert.equal(toMonthlyPrice(300, "quarter"), 100);

  const totals = sumFixedExpensesByCategory([
    { price: 500, period: "month", category: "business" },
    { price: 1200, period: "year", category: "private" },
    { price: 200, period: "month" },
  ]);

  assert.equal(totals.businessMonthly, 700);
  assert.equal(totals.privateMonthly, 100);

  console.log("fixedExpenseTotals tests passed");
}

runTests();
