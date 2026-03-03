/**
 * XP formula functions - pure, stateless, transparent
 * Each returns { raw, xp, formula } for UI display
 */

import { CONSISTENCY_BONUSES } from "./config";

/**
 * Volume XP: 12 × √hours
 * Diminishing returns, prevents grind advantage
 * @param {number} hours - Total hours logged this month
 * @returns {{ raw: number, xp: number, formula: string }}
 */
export function volumeXP(hours) {
  const raw = Number(hours) || 0;
  const xp = Math.max(0, Math.round(12 * Math.sqrt(raw)));
  return {
    raw,
    xp,
    formula: `12 × √${raw.toFixed(1)}`,
  };
}

/**
 * Value XP: revenue^0.6
 * Dampens extreme earners
 * @param {number} revenue - Total billable revenue this month
 * @returns {{ raw: number, xp: number, formula: string }}
 */
export function valueXP(revenue) {
  const raw = Number(revenue) || 0;
  const xp = Math.max(0, Math.round(Math.pow(raw, 0.6)));
  return {
    raw,
    xp,
    formula: raw > 0 ? `${raw.toFixed(0)}^0.6` : "0",
  };
}

/**
 * Growth XP: min(growthRate × 400, 300)
 * Negative growth -> 0 XP
 * @param {number} thisMonthRevenue
 * @param {number} lastMonthRevenue
 * @returns {{ raw: number, xp: number, formula: string }}
 */
export function growthXP(thisMonthRevenue, lastMonthRevenue) {
  const thisRev = Number(thisMonthRevenue) || 0;
  const lastRev = Number(lastMonthRevenue) || 0;
  let xp = 0;
  let formula = "0";

  if (lastRev > 0 && thisRev >= 0) {
    const growthRate = (thisRev - lastRev) / lastRev;
    if (growthRate > 0) {
      xp = Math.min(Math.round(growthRate * 400), 300);
      formula = `min(${(growthRate * 100).toFixed(1)}% × 400, 300)`;
    }
  }

  return {
    raw: lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : 0,
    xp,
    formula,
  };
}

/**
 * Consistency XP: sum of applicable bonuses
 * - 4 active weeks -> +150 XP
 * - No empty weeks -> +100 XP
 * - ≥16 active days -> +100 XP
 * @param {number} activeWeeks - Weeks with ≥3 active days
 * @param {number} weeksInMonth - Total weeks in month
 * @param {number} activeDays - Days with ≥1 hour
 * @returns {{ raw: object, xp: number, formula: string }}
 */
export function consistencyXP(activeWeeks, weeksInMonth, activeDays) {
  const aw = Number(activeWeeks) || 0;
  const wim = Number(weeksInMonth) || 1;
  const ad = Number(activeDays) || 0;

  const fourActiveWeeks = aw >= 4 ? CONSISTENCY_BONUSES.fourActiveWeeks : 0;
  const noEmptyWeeks = aw >= wim && wim > 0 ? CONSISTENCY_BONUSES.noEmptyWeeks : 0;
  const sixteenActiveDays = ad >= 16 ? CONSISTENCY_BONUSES.sixteenActiveDays : 0;

  const xp = fourActiveWeeks + noEmptyWeeks + sixteenActiveDays;
  const parts = [];
  if (fourActiveWeeks) parts.push("4 weken");
  if (noEmptyWeeks) parts.push("geen lege weken");
  if (sixteenActiveDays) parts.push("≥16 dagen");

  return {
    raw: { activeWeeks: aw, weeksInMonth: wim, activeDays: ad },
    xp,
    formula: parts.length ? parts.join(" + ") : "0",
  };
}
