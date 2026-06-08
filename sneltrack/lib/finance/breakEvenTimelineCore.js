import { computeNetAfterTax } from "./monthFinance.js";

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 0, 0, 0, 0);
}

function atMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function breakEvenTarget(privateCostsMonthly) {
  const priv = Number(privateCostsMonthly) || 0;
  return priv > 0 ? priv : 0;
}

/**
 * Break-even when projected net after tax covers private fixed costs (or >= 0 if none).
 *
 * @param {{
 *   businessCostsMonthly: number,
 *   privateCostsMonthly: number,
 *   taxReservePct: number,
 *   earningsThisMonth: number,
 *   hourlyRateForecast: number,
 *   weeklyHoursForecast: number,
 *   referenceDate?: Date,
 *   fixedCostsMonthly?: number,
 * }} args
 * @param {(date: Date) => boolean} isHolidayFn
 * @returns {{
 *   businessBreakEvenDate: Date|null,
 *   breakEvenDate: Date|null,
 *   projectedEarningsEnd: number|null,
 *   projectedFreeToSpendEnd: number|null,
 * }}
 */
export function computeBreakEvenTimelineWithHolidayCheck(
  args,
  isHolidayFn = () => false,
) {
  const {
    businessCostsMonthly = args?.fixedCostsMonthly ?? 0,
    privateCostsMonthly = 0,
    taxReservePct = 35,
    earningsThisMonth,
    hourlyRateForecast,
    weeklyHoursForecast,
    referenceDate = new Date(),
  } = args || {};

  const business = Number(businessCostsMonthly) || 0;
  const priv = Number(privateCostsMonthly) || 0;
  const pct = Number(taxReservePct) || 0;
  const earnings = Number(earningsThisMonth) || 0;
  const hourlyRate = Number(hourlyRateForecast);
  const weeklyHours = Number(weeklyHoursForecast);
  const target = breakEvenTarget(priv);

  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return {
      businessBreakEvenDate: null,
      breakEvenDate: null,
      projectedEarningsEnd: null,
      projectedFreeToSpendEnd: null,
    };
  }
  if (!Number.isFinite(weeklyHours) || weeklyHours <= 0) {
    return {
      businessBreakEvenDate: null,
      breakEvenDate: null,
      projectedEarningsEnd: null,
      projectedFreeToSpendEnd: null,
    };
  }

  const today = atMidnight(referenceDate);
  const currentNet = computeNetAfterTax(earnings, business, pct);
  const businessTarget = business > 0 ? business : 0;

  let businessBreakEvenDate =
    businessTarget === 0 || earnings >= businessTarget ? today : null;
  let breakEvenDate = currentNet >= target ? today : null;

  if (breakEvenDate) {
    const freeToSpend = currentNet - priv;
    return {
      businessBreakEvenDate,
      breakEvenDate,
      projectedEarningsEnd: earnings,
      projectedFreeToSpendEnd: freeToSpend,
    };
  }

  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const hoursPerCalendarDay = weeklyHours / 7;

  let projectedCum = earnings;

  const iter = new Date(today);
  iter.setDate(iter.getDate() + 1);

  while (iter <= monthEnd) {
    const d = atMidnight(iter);
    const availableHours = isHolidayFn(d) ? 0 : hoursPerCalendarDay;
    projectedCum += availableHours * hourlyRate;

    if (
      !businessBreakEvenDate &&
      businessTarget > 0 &&
      projectedCum >= businessTarget
    ) {
      businessBreakEvenDate = new Date(d);
    }

    const projectedNet = computeNetAfterTax(projectedCum, business, pct);
    if (!breakEvenDate && projectedNet >= target) {
      breakEvenDate = new Date(d);
    }

    iter.setDate(iter.getDate() + 1);
  }

  if (businessBreakEvenDate && businessBreakEvenDate < monthStart) {
    businessBreakEvenDate = null;
  }
  if (breakEvenDate && breakEvenDate < monthStart) {
    breakEvenDate = null;
  }

  const projectedNetEnd = computeNetAfterTax(projectedCum, business, pct);
  const projectedFreeToSpendEnd = projectedNetEnd - priv;

  return {
    businessBreakEvenDate,
    breakEvenDate,
    projectedEarningsEnd: projectedCum,
    projectedFreeToSpendEnd,
  };
}
