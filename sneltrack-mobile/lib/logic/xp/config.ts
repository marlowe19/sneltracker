// lib/logic/xp/config.ts
// Ported 1:1 from sneltrack/lib/xp/config.js
// XP Gamification configuration — weights and bonus thresholds.
// Efficiency excluded: no expenses/margin in this feature.

export const XP_WEIGHTS = {
  volume: 0.3,
  value: 0.3,
  growth: 0.2,
  consistency: 0.2,
} as const;

/** Consistency bonuses (XP per bonus) */
export const CONSISTENCY_BONUSES = {
  fourActiveWeeks: 150,
  noEmptyWeeks: 100,
  sixteenActiveDays: 100,
} as const;

/** Streak rewards: daily streak length -> XP bonus */
export const STREAK_DAILY_REWARDS: Record<number, number> = {
  3: 50,
  7: 150,
  14: 400,
  30: 1000,
};

/** Streak rewards: weekly streak length -> XP bonus */
export const STREAK_WEEKLY_REWARDS: Record<number, number> = {
  4: 250,
  8: 750,
  12: 1500,
};
