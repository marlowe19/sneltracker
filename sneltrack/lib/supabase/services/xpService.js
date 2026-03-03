/**
 * XP Service for gamification
 * Orchestrates get_user_xp_inputs RPC and XP engine
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  getMonthBoundsUTC,
  getWeekBoundsUTC,
  getDayBoundsUTC,
  getYearBoundsUTC,
} from "@/lib/dateRangeUtils";
import { calculateMonthlyXP } from "@/lib/xp/engine";
import { STREAK_DAILY_REWARDS, STREAK_WEEKLY_REWARDS } from "@/lib/xp/config";

const LIFETIME_MONTHS_CAP = 24;

/**
 * Get XP inputs for a user in a date range
 * @param {string} userName - Auth0 sub
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>} { total_hours, total_revenue, active_days_count, active_weeks_count, weeks_in_month }
 */
export async function getXPInputs(userName, startDate, endDate) {
  const { data, error } = await supabaseServer.rpc("get_user_xp_inputs", {
    p_user_name: userName,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) {
    console.error("Error fetching XP inputs:", error);
    throw error;
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) {
    return {
      total_hours: 0,
      total_revenue: 0,
      active_days_count: 0,
      active_weeks_count: 0,
      weeks_in_month: 4,
    };
  }

  return {
    total_hours: Number(row.total_hours) || 0,
    total_revenue: Number(row.total_revenue) || 0,
    active_days_count: Number(row.active_days_count) || 0,
    active_weeks_count: Number(row.active_weeks_count) || 0,
    weeks_in_month: Number(row.weeks_in_month) || 4,
  };
}

/**
 * Get XP inputs for multiple date ranges in one call
 * @param {string} userName
 * @param {Array<{start: Date, end: Date}>} ranges
 * @returns {Promise<Array<Object>>}
 */
export async function getXPInputsMulti(userName, ranges) {
  const rangesJson = ranges.map((r) => ({
    start: r.start.toISOString(),
    end: r.end.toISOString(),
  }));

  const { data, error } = await supabaseServer.rpc("get_user_xp_inputs_multi", {
    p_user_name: userName,
    p_ranges: rangesJson,
  });

  if (error) {
    console.error("Error fetching XP inputs multi:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    total_hours: Number(row.total_hours) || 0,
    total_revenue: Number(row.total_revenue) || 0,
    active_days_count: Number(row.active_days_count) || 0,
    active_weeks_count: Number(row.active_weeks_count) || 0,
    weeks_in_month: Number(row.weeks_in_month) || 4,
  }));
}

/**
 * Compute streak bonuses for a given daily and weekly streak
 * @param {number} dailyStreak
 * @param {number} weeklyStreak
 * @returns {{ daily: number, weekly: number }}
 */
export function computeStreakBonuses(dailyStreak, weeklyStreak) {
  let daily = 0;
  let weekly = 0;

  const dailyMilestones = Object.keys(STREAK_DAILY_REWARDS)
    .map(Number)
    .sort((a, b) => b - a);
  for (const m of dailyMilestones) {
    if (dailyStreak >= m) {
      daily = STREAK_DAILY_REWARDS[m];
      break;
    }
  }

  const weeklyMilestones = Object.keys(STREAK_WEEKLY_REWARDS)
    .map(Number)
    .sort((a, b) => b - a);
  for (const m of weeklyMilestones) {
    if (weeklyStreak >= m) {
      weekly = STREAK_WEEKLY_REWARDS[m];
      break;
    }
  }

  return { daily, weekly };
}

/**
 * Get bounds for a period and reference date
 * @param {string} period - day | week | month | year
 * @param {Date} refDate
 * @returns {{ start: Date, end: Date }}
 */
function getPeriodBounds(period, refDate) {
  switch (period) {
    case "day":
      return getDayBoundsUTC(refDate);
    case "week":
      return getWeekBoundsUTC(refDate);
    case "year":
      return getYearBoundsUTC(refDate);
    case "month":
    default:
      return getMonthBoundsUTC(refDate);
  }
}

/**
 * Get previous period bounds for growth comparison
 */
function getPreviousPeriodBounds(period, refDate) {
  const d = new Date(refDate);
  switch (period) {
    case "day":
      d.setDate(d.getDate() - 1);
      return getDayBoundsUTC(d);
    case "week":
      d.setDate(d.getDate() - 7);
      return getWeekBoundsUTC(d);
    case "month":
      d.setMonth(d.getMonth() - 1);
      return getMonthBoundsUTC(d);
    case "year":
      d.setFullYear(d.getFullYear() - 1);
      return getYearBoundsUTC(d);
    default:
      return getMonthBoundsUTC(d);
  }
}

/**
 * Format period label for display
 */
function formatPeriodLabel(period, refDate) {
  const d = new Date(refDate);
  switch (period) {
    case "day":
      return d.toLocaleDateString("nl-NL", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    case "week": {
      const { start, end } = getWeekBoundsUTC(refDate);
      return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("nl-NL", { month: "short" })} ${start.getFullYear()}`;
    }
    case "month":
      return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
    case "year":
      return String(d.getFullYear());
    default:
      return d.toLocaleDateString("nl-NL");
  }
}

/**
 * Compute lifetime XP by summing monthly XP for past N months (always from source)
 */
async function computeLifetimeXP(userName) {
  const now = new Date();
  const ranges = [];
  for (let i = 0; i < LIFETIME_MONTHS_CAP; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { start, end } = getMonthBoundsUTC(d);
    ranges.push({ start, end });
  }

  const inputsList = await getXPInputsMulti(userName, ranges);
  let total = 0;
  for (let i = 0; i < inputsList.length; i++) {
    const prevInputs = i < inputsList.length - 1 ? inputsList[i + 1] : null;
    const result = calculateMonthlyXP(inputsList[i], prevInputs, { daily: 0, weekly: 0 });
    total += result.total;
  }
  return total;
}

/**
 * Get full XP data for a user for a given period
 * @param {string} userName
 * @param {string} period - day | week | month | year
 * @param {string} date - YYYY-MM-DD for day/week, YYYY-MM for month, YYYY for year
 * @param {Object} [streakOverride] - Optional { daily, weekly } to override fetched streak
 * @returns {Promise<Object>} Full XP response
 */
export async function getUserXP(userName, period = "month", date = null, streakOverride = null) {
  const refDate = parseRefDate(period, date);
  const { start: thisStart, end: thisEnd } = getPeriodBounds(period, refDate);
  const { start: lastStart, end: lastEnd } = getPreviousPeriodBounds(period, refDate);

  const [thisInputs, lastInputs] = await getXPInputsMulti(userName, [
    { start: thisStart, end: thisEnd },
    { start: lastStart, end: lastEnd },
  ]);

  const streak =
    streakOverride ?? (await getStreak(userName)) ?? { daily: 0, weekly: 0 };
  const streakBonuses = computeStreakBonuses(streak.daily || 0, streak.weekly || 0);

  const result = calculateMonthlyXP(thisInputs, lastInputs, streakBonuses);

  const lifetimeXP = await computeLifetimeXP(userName);

  return {
    period,
    periodLabel: formatPeriodLabel(period, refDate),
    totalXP: result.total,
    breakdown: result.breakdown,
    inputs: result.inputs,
    streakBonuses: result.streakBonuses,
    streak: { daily: streak.daily || 0, weekly: streak.weekly || 0 },
    lifetimeXP,
  };
}

/**
 * Get leaderboard data for all users in a period
 * @param {string} currentUserName - Auth0 sub (for current user highlight)
 * @param {string} period - week | month | year
 * @param {string} date - YYYY-MM-DD or YYYY-MM or YYYY
 * @returns {Promise<Object>} { period, periodLabel, entries, currentUserRank, totalCount, topPercent }
 */
export async function getLeaderboard(currentUserName, period = "month", date = null) {
  const refDate = parseRefDate(period, date);
  const { start: thisStart, end: thisEnd } = getPeriodBounds(period, refDate);
  const { start: lastStart, end: lastEnd } = getPreviousPeriodBounds(period, refDate);

  const [
    { data: thisData, error: thisError },
    { data: lastData, error: lastError },
  ] = await Promise.all([
    supabaseServer.rpc("get_leaderboard_inputs", {
      p_start_date: thisStart.toISOString(),
      p_end_date: thisEnd.toISOString(),
    }),
    supabaseServer.rpc("get_leaderboard_inputs", {
      p_start_date: lastStart.toISOString(),
      p_end_date: lastEnd.toISOString(),
    }),
  ]);

  if (thisError) {
    console.error("Error fetching leaderboard:", thisError);
    throw thisError;
  }

  const thisRows = thisData || [];
  const lastByUser = new Map();
  for (const row of lastData || []) {
    lastByUser.set(row.user_name, {
      total_hours: Number(row.total_hours) || 0,
      total_revenue: Number(row.total_revenue) || 0,
      active_days_count: Number(row.active_days_count) || 0,
      active_weeks_count: Number(row.active_weeks_count) || 0,
      weeks_in_month: Number(row.weeks_in_period) || 4,
    });
  }

  const entries = [];
  for (const row of thisRows) {
    const thisInputs = {
      total_hours: Number(row.total_hours) || 0,
      total_revenue: Number(row.total_revenue) || 0,
      active_days_count: Number(row.active_days_count) || 0,
      active_weeks_count: Number(row.active_weeks_count) || 0,
      weeks_in_month: Number(row.weeks_in_period) || 4,
    };
    const lastInputs = lastByUser.get(row.user_name) || null;
    const result = calculateMonthlyXP(thisInputs, lastInputs, { daily: 0, weekly: 0 });
    entries.push({
      user_name: row.user_name,
      display_name: row.display_name || row.user_name,
      totalXP: result.total,
    });
  }

  entries.sort((a, b) => b.totalXP - a.totalXP);

  const ranked = entries.map((e, i) => ({
    ...e,
    rank: i + 1,
  }));

  const totalCount = ranked.length;
  const currentEntry = ranked.find((e) => e.user_name === currentUserName);
  const currentUserRank = currentEntry?.rank ?? null;
  const topPercent =
    currentUserRank && totalCount > 0
      ? Math.round((currentUserRank / totalCount) * 100)
      : null;

  return {
    period,
    periodLabel: formatPeriodLabel(period, refDate),
    entries: ranked,
    currentUserRank,
    totalCount,
    topPercent,
  };
}

function parseRefDate(period, dateStr) {
  if (!dateStr) return new Date();
  if (period === "year" && /^\d{4}$/.test(dateStr)) {
    return new Date(`${dateStr}-01-01`);
  }
  if (period === "month" && /^\d{4}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}-01`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  return new Date(dateStr);
}

/**
 * Get streak - from user_xp_state if available, else compute on-demand via get_user_streak RPC
 * @param {string} userName
 * @returns {Promise<{daily: number, weekly: number}>}
 */
export async function getStreak(userName) {
  try {
    const { data, error } = await supabaseServer
      .from("user_xp_state")
      .select("current_daily_streak, current_weekly_streak")
      .eq("user_name", userName)
      .maybeSingle();

    if (!error && data) {
      return {
        daily: Number(data.current_daily_streak) || 0,
        weekly: Number(data.current_weekly_streak) || 0,
      };
    }
  } catch {
    // Table may not exist yet
  }

  // Fallback: compute on-demand via RPC
  try {
    const { data, error } = await supabaseServer.rpc("get_user_streak", {
      p_user_name: userName,
    });

    if (error || !data || data.length === 0) {
      return { daily: 0, weekly: 0 };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      daily: Number(row?.daily_streak) || 0,
      weekly: Number(row?.weekly_streak) || 0,
    };
  } catch {
    return { daily: 0, weekly: 0 };
  }
}

