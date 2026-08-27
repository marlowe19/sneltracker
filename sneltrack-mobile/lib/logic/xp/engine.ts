// lib/logic/xp/engine.ts
// Ported 1:1 from sneltrack/lib/xp/engine.js
// XP calculation engine - stateless, recomputable.
// Orchestrates formulas and returns full breakdown for transparency.

import * as formulas from "./formulas.ts";
import type { XPFormulaResult, ConsistencyRaw } from "./formulas.ts";

export interface XPInputs {
  total_hours?: number;
  total_revenue?: number;
  active_days_count?: number;
  active_weeks_count?: number;
  weeks_in_month?: number;
}

export interface StreakBonuses {
  daily?: number;
  weekly?: number;
}

export interface XPBreakdown {
  volume: XPFormulaResult;
  value: XPFormulaResult;
  growth: XPFormulaResult<number | string>;
  consistency: XPFormulaResult<ConsistencyRaw>;
}

export interface MonthlyXPResult {
  total: number;
  breakdown: XPBreakdown;
  inputs: Required<XPInputs>;
  streakBonuses: { daily: number; weekly: number };
}

export function calculateMonthlyXP(
  inputs: XPInputs | null | undefined,
  lastMonthInputs: XPInputs | null = null,
  streakBonuses: StreakBonuses = {}
): MonthlyXPResult {
  const {
    total_hours = 0,
    total_revenue = 0,
    active_days_count = 0,
    active_weeks_count = 0,
    weeks_in_month = 4,
  } = inputs || {};

  const breakdown: XPBreakdown = {
    volume: formulas.volumeXP(total_hours),
    value: formulas.valueXP(total_revenue),
    growth: lastMonthInputs
      ? formulas.growthXP(total_revenue, lastMonthInputs.total_revenue || 0)
      : { raw: 0, xp: 0, formula: "—" },
    consistency: formulas.consistencyXP(active_weeks_count, weeks_in_month, active_days_count),
  };

  const baseTotal = Object.values(breakdown).reduce((sum, b) => sum + (b.xp || 0), 0);
  const dailyBonus = Number(streakBonuses.daily) || 0;
  const weeklyBonus = Number(streakBonuses.weekly) || 0;
  const total = Math.max(0, baseTotal + dailyBonus + weeklyBonus);

  return {
    total,
    breakdown,
    inputs: {
      total_hours,
      total_revenue,
      active_days_count,
      active_weeks_count,
      weeks_in_month,
    },
    streakBonuses: { daily: dailyBonus, weekly: weeklyBonus },
  };
}
