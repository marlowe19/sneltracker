import assert from "node:assert/strict";
import {
  canIncludeTeamEarnings,
  computeBillableTotals,
} from "../lib/finance/earningsTotals.js";

function runTests() {
  const sharedOwnerProject = {
    is_shared: true,
    is_owner: true,
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
    is_owner: true,
    billableHours: 5,
    billableAmount: 275,
    hourlyRate: 55,
    members: [],
  };

  // Team total when includeTeamEarnings is true
  {
    const totals = computeBillableTotals(
      [sharedOwnerProject, privateProject],
      "owner-user",
      true,
    );
    assert.equal(totals.totalBillableHours, 25);
    assert.equal(totals.totalBillableAmount, 1375);
  }

  // Only own hours on shared owner project when false
  {
    const totals = computeBillableTotals(
      [sharedOwnerProject, privateProject],
      "owner-user",
      false,
    );
    assert.equal(totals.totalBillableHours, 13);
    assert.equal(totals.totalBillableAmount, 715);
  }

  // Toggle visibility only for owner-level shared projects
  {
    assert.equal(canIncludeTeamEarnings([sharedOwnerProject]), true);
    assert.equal(canIncludeTeamEarnings([privateProject]), false);
    assert.equal(canIncludeTeamEarnings([]), false);
  }

  console.log("earningsTotals tests passed");
}

runTests();
