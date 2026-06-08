import assert from "node:assert/strict";
import {
  sumOwnProjectExpenses,
  hasOwnCountableProjectExpenses,
  isCountableProjectExpense,
} from "../lib/finance/projectExpenseTotals.js";

function runTests() {
  const expenses = [
    {
      user_name: "user-a",
      price: 100,
      billing_status: "draft",
    },
    {
      user_name: "user-a",
      price: 50,
      billing_status: "billed",
    },
    {
      user_name: "user-b",
      price: 200,
      billing_status: "draft",
    },
    {
      user_name: "user-a",
      price: 25,
      billing_status: "pending",
    },
  ];

  assert.equal(isCountableProjectExpense({ billing_status: "paid" }), false);
  assert.equal(isCountableProjectExpense({ billing_status: "draft" }), true);

  assert.equal(sumOwnProjectExpenses(expenses, "user-a"), 125);
  assert.equal(hasOwnCountableProjectExpenses(expenses, "user-a"), true);
  assert.equal(hasOwnCountableProjectExpenses(expenses, "user-b"), true);

  console.log("projectExpenseTotals tests passed");
}

runTests();
