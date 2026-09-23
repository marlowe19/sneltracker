import {
  getForecastHourlyRate,
  getForecastWeeklyHours,
  getTaxReservePct,
  getIncludeTeamEarnings,
  getIncludeProjectExpenses,
  getExpenseCategoryReviewDismissed,
} from "./forecastSettings.js";

function pick(dbValue, localGetter) {
  return dbValue != null ? dbValue : localGetter();
}

/**
 * Resolve finance settings: DB → localStorage → default (per field).
 * @param {object|null|undefined} dbSettings
 */
export function resolveFinanceSettings(dbSettings) {
  return {
    forecastHourlyRate: pick(
      dbSettings?.forecastHourlyRate,
      getForecastHourlyRate,
    ),
    forecastWeeklyHours: pick(
      dbSettings?.forecastWeeklyHours,
      getForecastWeeklyHours,
    ),
    taxReservePct: pick(dbSettings?.taxReservePct, getTaxReservePct),
    includeTeamEarnings: pick(
      dbSettings?.includeTeamEarnings,
      getIncludeTeamEarnings,
    ),
    includeProjectExpenses: pick(
      dbSettings?.includeProjectExpenses,
      getIncludeProjectExpenses,
    ),
    expenseCategoryReviewDismissed: pick(
      dbSettings?.expenseCategoryReviewDismissed,
      getExpenseCategoryReviewDismissed,
    ),
  };
}
