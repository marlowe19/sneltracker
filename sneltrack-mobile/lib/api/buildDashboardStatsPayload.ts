// lib/api/buildDashboardStatsPayload.ts
// Builds the POST /my/api/dashboard-stats request body. The route
// (sneltrack/app/my/api/dashboard-stats/route.js) requires exactly 3 week
// ranges (oldest -> newest) plus a month payload with expense/clip bounds
// and the list of week ranges overlapping the month.
import { getMonthBounds, getWeekBounds } from "../logic/time";
import type { DashboardStatsArgs } from "./endpoints";

function isoRange(start: Date, end: Date) {
  return { start: start.toISOString(), end: end.toISOString() };
}

export function buildDashboardStatsPayload(referenceDate: Date = new Date()): DashboardStatsArgs {
  const thisWeek = getWeekBounds(referenceDate);
  const lastWeekRef = new Date(thisWeek.start);
  lastWeekRef.setDate(lastWeekRef.getDate() - 7);
  const lastWeek = getWeekBounds(lastWeekRef);
  const twoWeeksAgoRef = new Date(thisWeek.start);
  twoWeeksAgoRef.setDate(twoWeeksAgoRef.getDate() - 14);
  const twoWeeksAgo = getWeekBounds(twoWeeksAgoRef);

  const month = getMonthBounds(referenceDate);

  const entryWeekRanges: Array<{ start: string; end: string }> = [];
  let cursor = getWeekBounds(month.start).start;
  while (cursor <= month.end) {
    const bounds = getWeekBounds(cursor);
    entryWeekRanges.push(isoRange(bounds.start, bounds.end));
    cursor = new Date(bounds.start);
    cursor.setDate(cursor.getDate() + 7);
  }

  return {
    weeks: [isoRange(twoWeeksAgo.start, twoWeeksAgo.end), isoRange(lastWeek.start, lastWeek.end), isoRange(thisWeek.start, thisWeek.end)],
    month: {
      expenseFrom: month.start.toISOString().slice(0, 10),
      expenseTo: month.end.toISOString().slice(0, 10),
      clipStartIso: month.start.toISOString(),
      clipEndIso: month.end.toISOString(),
      entryWeekRanges,
    },
    includeTeamEarnings: false,
    includeProjectExpenses: false,
    taxReservePct: 35,
  };
}
