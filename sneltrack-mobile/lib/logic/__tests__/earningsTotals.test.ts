// lib/logic/__tests__/earningsTotals.test.ts
// Ported from sneltrack/tests/earningsTotals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { canIncludeTeamEarnings, computeBillableTotals } from "../finance/earningsTotals.ts";

const sharedOwnerProject = {
  is_shared: true,
  billableHours: 20,
  billableAmount: 1100,
  hourlyRate: 55,
  members: [
    { user_name: "owner-user", billableHours: 8 },
    { user_name: "member-user", billableHours: 12 },
  ],
};

const privateProject = {
  is_shared: false,
  billableHours: 5,
  billableAmount: 275,
  hourlyRate: 55,
  members: [],
};

test("computeBillableTotals: team total when includeTeamEarnings is true", () => {
  const totals = computeBillableTotals([sharedOwnerProject, privateProject], "owner-user", true);
  assert.equal(totals.totalBillableHours, 25);
  assert.equal(totals.totalBillableAmount, 1375);
});

test("computeBillableTotals: only own hours on shared owner project when false", () => {
  const totals = computeBillableTotals([sharedOwnerProject, privateProject], "owner-user", false);
  assert.equal(totals.totalBillableHours, 13);
  assert.equal(totals.totalBillableAmount, 715);
});

test("canIncludeTeamEarnings: toggle visibility only for owner-level shared projects", () => {
  assert.equal(canIncludeTeamEarnings([sharedOwnerProject]), true);
  assert.equal(canIncludeTeamEarnings([privateProject]), false);
  assert.equal(canIncludeTeamEarnings([]), false);
});
