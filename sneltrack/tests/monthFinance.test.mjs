import assert from "node:assert/strict";
import {
  computeMonthFinance,
  computeNetAfterTax,
  computeTaxReserve,
} from "../lib/finance/monthFinance.js";

function runTests() {
  {
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
  }

  {
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
  }

  assert.equal(computeTaxReserve(-100, 35), 0);
  assert.equal(computeNetAfterTax(2000, 500, 35), 975);

  console.log("monthFinance tests passed");
}

runTests();
