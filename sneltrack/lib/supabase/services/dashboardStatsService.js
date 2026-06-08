import { getWeekEntries } from "./timeEntriesService";
import { computeEntryDurationMsClipped } from "@/lib/time";
import { getAll as getFixedExpenses } from "./fixedExpensesService";
import { getExpensesBetweenDates } from "./expensesService";
import { sumOwnProjectExpenses } from "@/lib/finance/projectExpenseTotals";
import { getUserProjectReports } from "./reportsService";
import { computeBillableTotals } from "@/lib/finance/earningsTotals";
import { sumFixedExpensesByCategory } from "@/lib/finance/fixedExpenseTotals";
import { computeMonthFinance } from "@/lib/finance/monthFinance";
import { DEFAULT_TAX_RESERVE_PCT } from "@/lib/preferences/forecastSettings";

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
export function aggregateHoursForUser(entries, userName, rangeStart, rangeEnd) {
  let ms = 0;
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
  }
  return { hours: ms / (1000 * 60 * 60) };
}

export function aggregateBillableHoursAndRevenueForUser(
  entries,
  userName,
  rangeStart,
  rangeEnd,
) {
  let ms = 0;
  let revenue = 0;

  for (const e of entries) {
    if (e.user_name !== userName) continue;
    const isBillable = e.billable ?? true;
    if (isBillable === false) continue;

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

function mapReportsForEarnings(projectReports) {
  return (projectReports ?? []).map((p) => ({
    is_shared: p.is_shared,
    billableHours: p.billableHours,
    billableAmount: Number(p.statistics?.totalMoney ?? 0),
    hourlyRate: p.hourlyRate,
    members: p.members,
  }));
}

/**
 * @param {string} userName
 * @param {Array<{ start: string, end: string }>} weekRangesIso Oldest → newest (3 weeks)
 * @param {{ expenseFrom: string, expenseTo: string, clipStartIso: string, clipEndIso: string, entryWeekRanges: Array<{ start: string, end: string }> }} monthPayload
 * @param {boolean} [includeTeamEarnings=false]
 * @param {number} [taxReservePct=35]
 * @param {boolean} [includeProjectExpenses=false]
 */
export async function computeDashboardStats(
  userName,
  weekRangesIso,
  monthPayload,
  includeTeamEarnings = false,
  taxReservePct = DEFAULT_TAX_RESERVE_PCT,
  includeProjectExpenses = false,
) {
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

  const t2 = aggregateHoursForUser(
    uniqueEntries.values(),
    userName,
    new Date(w2.start),
    new Date(w2.end),
  );
  const t2Billable = aggregateBillableHoursAndRevenueForUser(
    uniqueEntries.values(),
    userName,
    new Date(w2.start),
    new Date(w2.end),
  );

  const t1 = aggregateHoursForUser(
    uniqueEntries.values(),
    userName,
    new Date(w1.start),
    new Date(w1.end),
  );
  const t1Billable = aggregateBillableHoursAndRevenueForUser(
    uniqueEntries.values(),
    userName,
    new Date(w1.start),
    new Date(w1.end),
  );

  const t0 = aggregateHoursForUser(
    uniqueEntries.values(),
    userName,
    new Date(w0.start),
    new Date(w0.end),
  );
  const t0Billable = aggregateBillableHoursAndRevenueForUser(
    uniqueEntries.values(),
    userName,
    new Date(w0.start),
    new Date(w0.end),
  );

  const avgHours = (t1.hours + t2.hours) / 2;
  const avgRevenue = (t1Billable.revenue + t2Billable.revenue) / 2;

  const hoursDelta = pctVsBaseline(t0.hours, avgHours);
  const revenueDelta = pctVsBaseline(t0Billable.revenue, avgRevenue);

  const fixedExpenses = await getFixedExpenses(userName);
  const { businessMonthly: fixedBusinessMonthly, privateMonthly } =
    sumFixedExpensesByCategory(fixedExpenses);

  const projectExpenses = await getExpensesBetweenDates(
    userName,
    monthPayload.expenseFrom,
    monthPayload.expenseTo,
  );
  const projectExpensesMonthly = sumOwnProjectExpenses(
    projectExpenses,
    userName,
  );
  const businessMonthly =
    fixedBusinessMonthly +
    (includeProjectExpenses ? projectExpensesMonthly : 0);

  // Factureerbare verdiensten from same report logic as onkostenpagina
  const monthStart = new Date(monthPayload.clipStartIso);
  const monthEnd = new Date(monthPayload.clipEndIso);
  const projectReports = await getUserProjectReports(
    userName,
    monthStart,
    monthEnd,
  );
  const { totalBillableHours, totalBillableAmount } = computeBillableTotals(
    mapReportsForEarnings(projectReports),
    userName,
    includeTeamEarnings,
  );
  const earningsThisMonth = totalBillableAmount;
  const hoursThisMonth = totalBillableHours;

  const finance = computeMonthFinance({
    earnings: earningsThisMonth,
    businessCostsMonthly: businessMonthly,
    privateCostsMonthly: privateMonthly,
    taxReservePct,
  });

  return {
    weekly: {
      thisWeekHours: t0.hours,
      avgPrevTwoWeeksHours: avgHours,
      hoursPct: hoursDelta.pct,
      hoursTrend: hoursDelta.trend,
      thisWeekRevenue: t0Billable.revenue,
      avgPrevTwoWeeksRevenue: avgRevenue,
      revenuePct: revenueDelta.pct,
      revenueTrend: revenueDelta.trend,
    },
    monthFinance: {
      earnings: earningsThisMonth,
      hours: hoursThisMonth,
      fixedBusinessCostsMonthly: fixedBusinessMonthly,
      projectExpensesMonthly,
      businessCostsMonthly: businessMonthly,
      privateCostsMonthly: privateMonthly,
      businessCostsYearly: businessMonthly * 12,
      profit: finance.profit,
      taxReserve: finance.taxReserve,
      taxReservePct: finance.taxReservePct,
      netAfterTax: finance.netAfterTax,
      freeToSpend: finance.freeToSpend,
      expensePercentage: finance.expensePercentage,
    },
  };
}
