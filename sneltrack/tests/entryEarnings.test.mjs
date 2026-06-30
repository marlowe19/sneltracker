import assert from "node:assert/strict";
import {
  computeActivitiesBillableMoney,
  computeBillableMoney,
  computeEntryBillableMoney,
  isBillable,
} from "../lib/finance/entryEarnings.js";

function runTests() {
  assert.equal(isBillable(true), true);
  assert.equal(isBillable(undefined), true);
  assert.equal(isBillable(null), true);
  assert.equal(isBillable(false), false);

  const oneHourMs = 60 * 60 * 1000;

  assert.equal(computeBillableMoney(oneHourMs, 100, true), 100);
  assert.equal(computeBillableMoney(oneHourMs, 100, false), 0);
  assert.equal(computeBillableMoney(oneHourMs, 100), 100);

  assert.equal(
    computeEntryBillableMoney(
      { hourly_rate: 50, billable: false },
      oneHourMs,
    ),
    0,
  );
  assert.equal(
    computeEntryBillableMoney(
      { hourly_rate: 50, billable: true },
      oneHourMs,
    ),
    50,
  );
  assert.equal(
    computeEntryBillableMoney(
      {
        hourly_rate: 50,
        billable: true,
        billable_editable: false,
        hourly_rate_editable: "80",
      },
      oneHourMs,
      { useEditableFields: true },
    ),
    0,
  );

  const activities = [
    {
      start_time: "2026-01-01T09:00:00.000Z",
      end_time: "2026-01-01T10:00:00.000Z",
      hourly_rate: 100,
      billable: true,
    },
    {
      start_time: "2026-01-01T10:00:00.000Z",
      end_time: "2026-01-01T11:00:00.000Z",
      hourly_rate: 100,
      billable: false,
    },
  ];
  assert.equal(computeActivitiesBillableMoney(activities), 100);

  console.log("entryEarnings.test.mjs: all tests passed");
}

runTests();
