import assert from "node:assert/strict";
import { resolveFinanceSettings } from "../lib/preferences/resolveFinanceSettings.js";
import {
  DEFAULT_FORECAST_HOURLY_RATE,
  DEFAULT_FORECAST_WEEKLY_HOURS,
  DEFAULT_TAX_RESERVE_PCT,
} from "../lib/preferences/forecastSettings.js";

function runTests() {
  const defaults = resolveFinanceSettings(null);
  assert.equal(defaults.forecastHourlyRate, DEFAULT_FORECAST_HOURLY_RATE);
  assert.equal(defaults.forecastWeeklyHours, DEFAULT_FORECAST_WEEKLY_HOURS);
  assert.equal(defaults.taxReservePct, DEFAULT_TAX_RESERVE_PCT);
  assert.equal(defaults.includeTeamEarnings, false);
  assert.equal(defaults.includeProjectExpenses, false);
  assert.equal(defaults.expenseCategoryReviewDismissed, false);

  const fromDb = resolveFinanceSettings({
    forecastHourlyRate: 72.5,
    forecastWeeklyHours: 32,
    taxReservePct: 25,
    includeTeamEarnings: true,
    includeProjectExpenses: false,
    expenseCategoryReviewDismissed: true,
  });
  assert.equal(fromDb.forecastHourlyRate, 72.5);
  assert.equal(fromDb.forecastWeeklyHours, 32);
  assert.equal(fromDb.taxReservePct, 25);
  assert.equal(fromDb.includeTeamEarnings, true);
  assert.equal(fromDb.includeProjectExpenses, false);
  assert.equal(fromDb.expenseCategoryReviewDismissed, true);

  const falseBooleans = resolveFinanceSettings({
    forecastHourlyRate: 60,
    forecastWeeklyHours: 40,
    taxReservePct: 35,
    includeTeamEarnings: false,
    includeProjectExpenses: false,
    expenseCategoryReviewDismissed: false,
  });
  assert.equal(falseBooleans.includeTeamEarnings, false);
  assert.equal(falseBooleans.includeProjectExpenses, false);
  assert.equal(falseBooleans.expenseCategoryReviewDismissed, false);

  console.log("resolveFinanceSettings tests passed");
}

runTests();
