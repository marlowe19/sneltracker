// lib/logic/xp/formulas.ts
// Ported 1:1 from sneltrack/lib/xp/formulas.js
// XP formula functions - pure, stateless, transparent.
// Each returns { raw, xp, formula } for UI display.

import { CONSISTENCY_BONUSES } from "./config.ts";

export interface XPFormulaResult<TRaw = number> {
  raw: TRaw;
  xp: number;
  formula: string;
}

/** Volume XP: 12 × √hours. Diminishing returns, prevents grind advantage. */
export function volumeXP(hours: number): XPFormulaResult {
  const raw = Number(hours) || 0;
  const xp = Math.max(0, Math.round(12 * Math.sqrt(raw)));
  return {
    raw,
    xp,
    formula: `12 × √${raw.toFixed(1)}`,
  };
}

/** Value XP: revenue^0.6. Dampens extreme earners. */
export function valueXP(revenue: number): XPFormulaResult {
  const raw = Number(revenue) || 0;
  const xp = Math.max(0, Math.round(Math.pow(raw, 0.6)));
  return {
    raw,
    xp,
    formula: raw > 0 ? `${raw.toFixed(0)}^0.6` : "0",
  };
}

/** Growth XP: min(growthRate × 400, 300). Negative growth -> 0 XP. */
export function growthXP(thisMonthRevenue: number, lastMonthRevenue: number): XPFormulaResult {
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

export interface ConsistencyRaw {
  activeWeeks: number;
  weeksInMonth: number;
  activeDays: number;
}

/**
 * Consistency XP: sum of applicable bonuses
 * - 4 active weeks -> +150 XP
 * - No empty weeks -> +100 XP
 * - >=16 active days -> +100 XP
 */
export function consistencyXP(
  activeWeeks: number,
  weeksInMonth: number,
  activeDays: number
): XPFormulaResult<ConsistencyRaw> {
  const aw = Number(activeWeeks) || 0;
  const wim = Number(weeksInMonth) || 1;
  const ad = Number(activeDays) || 0;

  const fourActiveWeeks = aw >= 4 ? CONSISTENCY_BONUSES.fourActiveWeeks : 0;
  const noEmptyWeeks = aw >= wim && wim > 0 ? CONSISTENCY_BONUSES.noEmptyWeeks : 0;
  const sixteenActiveDays = ad >= 16 ? CONSISTENCY_BONUSES.sixteenActiveDays : 0;

  const xp = fourActiveWeeks + noEmptyWeeks + sixteenActiveDays;
  const parts: string[] = [];
  if (fourActiveWeeks) parts.push("4 weken");
  if (noEmptyWeeks) parts.push("geen lege weken");
  if (sixteenActiveDays) parts.push("≥16 dagen");

  return {
    raw: { activeWeeks: aw, weeksInMonth: wim, activeDays: ad },
    xp,
    formula: parts.length ? parts.join(" + ") : "0",
  };
}
