/**
 * XP calculation engine - stateless, recomputable
 * Orchestrates formulas and returns full breakdown for transparency
 */

import * as formulas from "./formulas.js";

/**
 * Calculate monthly XP from raw inputs
 * @param {Object} inputs - From get_user_xp_inputs RPC
 * @param {number} inputs.total_hours
 * @param {number} inputs.total_revenue
 * @param {number} inputs.active_days_count
 * @param {number} inputs.active_weeks_count
 * @param {number} inputs.weeks_in_month
 * @param {Object|null} lastMonthInputs - Same shape, for growth XP
 * @param {Object} [streakBonuses] - { daily: number, weekly: number } XP from streaks
 * @returns {{ total: number, breakdown: Object, inputs: Object }}
 */
export function calculateMonthlyXP(inputs, lastMonthInputs = null, streakBonuses = {}) {
  const {
    total_hours = 0,
    total_revenue = 0,
    active_days_count = 0,
    active_weeks_count = 0,
    weeks_in_month = 4,
  } = inputs || {};

  const breakdown = {
    volume: formulas.volumeXP(total_hours),
    value: formulas.valueXP(total_revenue),
    growth: lastMonthInputs
      ? formulas.growthXP(total_revenue, lastMonthInputs.total_revenue || 0)
      : { raw: 0, xp: 0, formula: "—" },
    consistency: formulas.consistencyXP(
      active_weeks_count,
      weeks_in_month,
      active_days_count
    ),
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
