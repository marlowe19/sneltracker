const HOURLY_RATE_KEY = "sneltrack:forecastHourlyRate";
const WEEKLY_HOURS_KEY = "sneltrack:forecastWeeklyHours";
export const INCLUDE_TEAM_EARNINGS_KEY = "sneltrack:includeTeamEarnings";
export const TAX_RESERVE_PCT_KEY = "sneltrack:taxReservePct";
export const INCLUDE_PROJECT_EXPENSES_KEY = "sneltrack:includeProjectExpenses";

export const DEFAULT_FORECAST_HOURLY_RATE = 55;
export const DEFAULT_FORECAST_WEEKLY_HOURS = 40;
export const DEFAULT_TAX_RESERVE_PCT = 35;

export function getForecastHourlyRate() {
  if (typeof window === "undefined") return DEFAULT_FORECAST_HOURLY_RATE;
  try {
    const stored = localStorage.getItem(HOURLY_RATE_KEY);
    const n = stored ? parseFloat(stored) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FORECAST_HOURLY_RATE;
  } catch {
    return DEFAULT_FORECAST_HOURLY_RATE;
  }
}

export function getForecastWeeklyHours() {
  if (typeof window === "undefined") return DEFAULT_FORECAST_WEEKLY_HOURS;
  try {
    const stored = localStorage.getItem(WEEKLY_HOURS_KEY);
    const n = stored ? parseFloat(stored) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FORECAST_WEEKLY_HOURS;
  } catch {
    return DEFAULT_FORECAST_WEEKLY_HOURS;
  }
}

export function setForecastHourlyRate(rate) {
  if (typeof window === "undefined") return;
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return;
  try {
    localStorage.setItem(HOURLY_RATE_KEY, String(n));
  } catch {
    // ignore
  }
}

export function setForecastWeeklyHours(hours) {
  if (typeof window === "undefined") return;
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return;
  try {
    localStorage.setItem(WEEKLY_HOURS_KEY, String(n));
  } catch {
    // ignore
  }
}

export function getIncludeTeamEarnings() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INCLUDE_TEAM_EARNINGS_KEY) === "true";
  } catch {
    return false;
  }
}

export function setIncludeTeamEarnings(include) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INCLUDE_TEAM_EARNINGS_KEY, include ? "true" : "false");
  } catch {
    // ignore
  }
}

export function getTaxReservePct() {
  if (typeof window === "undefined") return DEFAULT_TAX_RESERVE_PCT;
  try {
    const stored = localStorage.getItem(TAX_RESERVE_PCT_KEY);
    const n = stored ? parseFloat(stored) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 100
      ? n
      : DEFAULT_TAX_RESERVE_PCT;
  } catch {
    return DEFAULT_TAX_RESERVE_PCT;
  }
}

export function setTaxReservePct(pct) {
  if (typeof window === "undefined") return;
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0 || n > 100) return;
  try {
    localStorage.setItem(TAX_RESERVE_PCT_KEY, String(n));
  } catch {
    // ignore
  }
}

export function getIncludeProjectExpenses() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INCLUDE_PROJECT_EXPENSES_KEY) === "true";
  } catch {
    return false;
  }
}

export function setIncludeProjectExpenses(include) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      INCLUDE_PROJECT_EXPENSES_KEY,
      include ? "true" : "false",
    );
  } catch {
    // ignore
  }
}
