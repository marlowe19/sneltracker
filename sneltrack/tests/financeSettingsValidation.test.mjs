import assert from "node:assert/strict";

function validatePartial(updates) {
  const data = {};

  if (updates.forecastHourlyRate !== undefined) {
    const n = Number(updates.forecastHourlyRate);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("forecastHourlyRate must be a positive number");
    }
    data.forecast_hourly_rate = n;
  }

  if (updates.forecastWeeklyHours !== undefined) {
    const n = Number(updates.forecastWeeklyHours);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("forecastWeeklyHours must be a positive number");
    }
    data.forecast_weekly_hours = n;
  }

  if (updates.taxReservePct !== undefined) {
    const n = Number(updates.taxReservePct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error("taxReservePct must be between 0 and 100");
    }
    data.tax_reserve_pct = n;
  }

  if (updates.includeTeamEarnings !== undefined) {
    data.include_team_earnings = Boolean(updates.includeTeamEarnings);
  }

  if (updates.includeProjectExpenses !== undefined) {
    data.include_project_expenses = Boolean(updates.includeProjectExpenses);
  }

  if (updates.expenseCategoryReviewDismissed !== undefined) {
    data.expense_category_review_dismissed = Boolean(
      updates.expenseCategoryReviewDismissed,
    );
  }

  return data;
}

function runTests() {
  assert.deepEqual(validatePartial({ forecastHourlyRate: 60 }), {
    forecast_hourly_rate: 60,
  });

  assert.throws(
    () => validatePartial({ forecastHourlyRate: 0 }),
    /positive number/,
  );

  assert.throws(
    () => validatePartial({ taxReservePct: 101 }),
    /between 0 and 100/,
  );

  assert.deepEqual(validatePartial({ includeTeamEarnings: false }), {
    include_team_earnings: false,
  });

  console.log("financeSettingsValidation tests passed");
}

runTests();
