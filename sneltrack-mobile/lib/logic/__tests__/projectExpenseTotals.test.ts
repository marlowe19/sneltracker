// lib/logic/__tests__/projectExpenseTotals.test.ts
// Ported from sneltrack/tests/projectExpenseTotals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  sumOwnProjectExpenses,
  hasOwnCountableProjectExpenses,
  isCountableProjectExpense,
} from "../finance/projectExpenseTotals.ts";

const expenses = [
  { user_name: "user-a", price: 100, billing_status: "draft" },
  { user_name: "user-a", price: 50, billing_status: "billed" },
  { user_name: "user-b", price: 200, billing_status: "draft" },
  { user_name: "user-a", price: 25, billing_status: "pending" },
];

test("isCountableProjectExpense excludes billed/paid statuses", () => {
  assert.equal(isCountableProjectExpense({ billing_status: "paid" }), false);
  assert.equal(isCountableProjectExpense({ billing_status: "draft" }), true);
});

test("sumOwnProjectExpenses sums only own countable expenses", () => {
  assert.equal(sumOwnProjectExpenses(expenses, "user-a"), 125);
  assert.equal(hasOwnCountableProjectExpenses(expenses, "user-a"), true);
  assert.equal(hasOwnCountableProjectExpenses(expenses, "user-b"), true);
});
