/**
 * XP Gamification configuration
 * Weights and bonus thresholds (admin-configurable later via DB)
 * Efficiency excluded: no expenses/margin in this feature
 */

export const XP_WEIGHTS = {
  volume: 0.3,
  value: 0.3,
  growth: 0.2,
  consistency: 0.2,
};

/** Consistency bonuses (XP per bonus) */
export const CONSISTENCY_BONUSES = {
  fourActiveWeeks: 150,
  noEmptyWeeks: 100,
  sixteenActiveDays: 100,
};

/** Streak rewards: daily streak length -> XP bonus */
export const STREAK_DAILY_REWARDS = {
  3: 50,
  7: 150,
  14: 400,
  30: 1000,
};

/** Streak rewards: weekly streak length -> XP bonus */
export const STREAK_WEEKLY_REWARDS = {
  4: 250,
  8: 750,
  12: 1500,
};
