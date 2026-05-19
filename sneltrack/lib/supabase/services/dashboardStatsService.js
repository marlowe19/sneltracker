import { getWeekEntries } from "./timeEntriesService";
import { getExpensesBetweenDates } from "./expensesService";
import { computeEntryDurationMsClipped } from "@/lib/time";

/**
 * @param {Array<Array<Object>>} weekEntryLists
 * @returns {Map<string, Object>}
 */
function mergeEntriesById(weekEntryLists) {
  const map = new Map();
  for (const list of weekEntryLists) {
    for (const e of list || []) {
      if (e?.id) map.set(e.id, e);
    }
  }
  return map;
}

/**
 * @param {Iterable<Object>} entries
 * @param {string} userName
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {{ hours: number, revenue: number }}
 */
export function aggregateHoursAndRevenueForUser(
  entries,
  userName,
  rangeStart,
  rangeEnd,
) {
  let ms = 0;
  let revenue = 0;
  for (const e of entries) {
    if (e.user_name !== userName) continue;
    const duration = computeEntryDurationMsClipped(
      e.start_time,
      e.end_time,
      rangeStart,
      rangeEnd,
      e.duration_ms ?? null,
    );
    if (duration === 0) continue;
    ms += duration;
    const rate = e.hourly_rate;
    if (rate != null && Number(rate) > 0) {
      const hours = duration / (1000 * 60 * 60);
      revenue += hours * Number(rate);
    }
  }
  return {
    hours: ms / (1000 * 60 * 60),
    revenue,
  };
}

function pctVsBaseline(current, baseline) {
  if (baseline === 0) {
    if (current === 0) return { pct: 0, trend: "flat" };
    return { pct: null, trend: "up" };
  }
  const pct = ((current - baseline) / baseline) * 100;
  const trend =
    pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct, trend };
}

/**
 * @param {string} userName
 * @param {Array<{ start: string, end: string }>} weekRangesIso Oldest → newest (3 weeks)
 * @param {{ expenseFrom: string, expenseTo: string, clipStartIso: string, clipEndIso: string, entryWeekRanges: Array<{ start: string, end: string }> }} monthPayload
 */
export async function computeDashboardStats(userName, weekRangesIso, monthPayload) {
  if (!weekRangesIso || weekRangesIso.length !== 3) {
    throw new Error("Expected exactly 3 week ranges (oldest → newest)");
  }

  const weekFetches = weekRangesIso.map((w) =>
    getWeekEntries(userName, w.start, w.end),
  );
  const weekLists = await Promise.all(weekFetches);
  const uniqueEntries = mergeEntriesById(weekLists);

  const w2 = weekRangesIso[0];
  const w1 = weekRangesIso[1];
  const w0 = weekRangesIso[2];

  const t2 = aggregateHoursAndRevenueForUser(
    uniqueEntries.values(),
    userName,
    new Date(w2.start),
    new Date(w2.end),
  );
  const t1 = aggregateHoursAndRevenueForUser(
    uniqueEntries.values(),
    userName,
    new Date(w1.start),
    new Date(w1.end),
  );
  const t0 = aggregateHoursAndRevenueForUser(
    uniqueEntries.values(),
    userName,
    new Date(w0.start),
    new Date(w0.end),
  );

  const avgHours = (t1.hours + t2.hours) / 2;
  const avgRevenue = (t1.revenue + t2.revenue) / 2;

  const hoursDelta = pctVsBaseline(t0.hours, avgHours);
  const revenueDelta = pctVsBaseline(t0.revenue, avgRevenue);

  const monthClipStart = new Date(monthPayload.clipStartIso);
  const monthClipEnd = new Date(monthPayload.clipEndIso);

  const monthWeekLists = await Promise.all(
    (monthPayload.entryWeekRanges || []).map((w) =>
      getWeekEntries(userName, w.start, w.end),
    ),
  );
  const monthUnique = mergeEntriesById(monthWeekLists);
  const monthTotals = aggregateHoursAndRevenueForUser(
    monthUnique.values(),
    userName,
    monthClipStart,
    monthClipEnd,
  );

  const monthExpenses = await getExpensesBetweenDates(
    userName,
    monthPayload.expenseFrom,
    monthPayload.expenseTo,
  );
  const expensesTotal = monthExpenses.reduce(
    (s, x) => s + (Number(x.price) || 0),
    0,
  );

  const earnings = monthTotals.revenue;
  const gap = earnings - expensesTotal;

  return {
    weekly: {
      thisWeekHours: t0.hours,
      avgPrevTwoWeeksHours: avgHours,
      hoursPct: hoursDelta.pct,
      hoursTrend: hoursDelta.trend,
      thisWeekRevenue: t0.revenue,
      avgPrevTwoWeeksRevenue: avgRevenue,
      revenuePct: revenueDelta.pct,
      revenueTrend: revenueDelta.trend,
    },
    monthGap: {
      earnings,
      expenses: expensesTotal,
      gap,
    },
  };
}
