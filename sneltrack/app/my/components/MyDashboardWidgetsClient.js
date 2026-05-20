"use client";

import { useEffect, useState, useCallback } from "react";
import { addWeeks } from "date-fns";
import { ArrowDown, ArrowUp, SubtractAlt } from "@carbon/icons-react";
import { getWeekBounds, getMonthBounds, toIso } from "@/lib/time";

function fmtYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function collectEntryWeekRangesForMonth(monthStart, monthEnd) {
  const weeks = [];
  let curStart = getWeekBounds(monthStart).start;
  while (curStart <= monthEnd) {
    const { start, end } = getWeekBounds(curStart);
    if (end >= monthStart && start <= monthEnd) {
      weeks.push({ start: toIso(start), end: toIso(end) });
    }
    curStart = addWeeks(start, 1);
  }
  return weeks;
}

function buildDashboardStatsBody() {
  const now = new Date();
  const w0 = getWeekBounds(now);
  const w1 = getWeekBounds(addWeeks(w0.start, -1));
  const w2 = getWeekBounds(addWeeks(w1.start, -1));
  const m = getMonthBounds(now);

  return {
    weeks: [
      { start: toIso(w2.start), end: toIso(w2.end) },
      { start: toIso(w1.start), end: toIso(w1.end) },
      { start: toIso(w0.start), end: toIso(w0.end) },
    ],
    month: {
      expenseFrom: fmtYmd(m.start),
      expenseTo: fmtYmd(m.end),
      clipStartIso: m.start.toISOString(),
      clipEndIso: m.end.toISOString(),
      entryWeekRanges: collectEntryWeekRangesForMonth(m.start, m.end),
    },
  };
}

function formatHoursOneDecimal(h) {
  return (Math.round(h * 10) / 10).toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatEur(n) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const widgetCardClass =
  "rounded-xl border border-[#e6e6e6] bg-[#f8f9fa] shadow-sm p-3 sm:p-4";

function TrendPill({ pct, trend }) {
  const showPct = pct !== null && Number.isFinite(pct);
  const label = showPct
    ? `${pct > 0 ? "+" : ""}${Math.round(pct)}%`
    : trend === "up"
      ? "↑"
      : "—";

  const palette =
    trend === "up"
      ? "bg-orange-100 text-gray-900"
      : trend === "down"
        ? "bg-sky-100 text-gray-900"
        : "bg-gray-100 text-gray-700";

  const Icon =
    trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : SubtractAlt;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:gap-1 sm:px-2.5 sm:py-1 sm:text-xs ${palette}`}
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      {label}
    </span>
  );
}

function WeeklyStatBlock({
  label,
  primaryValue,
  primarySuffix,
  avgLabel,
  pct,
  trend,
}) {
  return (
    <div className={`relative min-w-0 flex-1 ${widgetCardClass}`}>
      <p className="text-[10px] font-semibold tracking-wide text-gray-600 uppercase leading-tight sm:text-[11px]">
        {label}
      </p>
      <div className="mt-0.5 flex items-start justify-between gap-1 sm:mt-1 sm:gap-2">
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none text-[#008eff] sm:text-3xl">
            {primaryValue}
            {primarySuffix ? (
              <span className="ml-0.5 text-sm font-semibold text-gray-600 sm:ml-1 sm:text-base">
                {primarySuffix}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-gray-500 sm:mt-1.5 sm:text-xs">
            {avgLabel}
          </p>
        </div>
        <TrendPill pct={pct} trend={trend} />
      </div>
    </div>
  );
}

export default function MyDashboardWidgetsClient() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/my/api/dashboard-stats", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDashboardStatsBody()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || "Kon statistieken niet laden");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="w-full px-4 pt-2 pb-1 shrink-0">
        <div className="flex justify-center py-3 sm:py-6">
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-[#008eff] border-t-transparent"
            aria-hidden
          />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="w-full px-4 pt-2 pb-1 shrink-0">
        <p className="text-center text-xs text-rose-600">
          {error || "Kon statistieken niet laden"}
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-2 mx-auto block text-xs font-medium text-[#008eff] underline"
        >
          Opnieuw proberen
        </button>
      </section>
    );
  }

  const { weekly, monthGap } = data;
  const hoursAvg = formatHoursOneDecimal(weekly.avgPrevTwoWeeksHours);
  const revAvg = formatEur(weekly.avgPrevTwoWeeksRevenue);

  const gapPositive = monthGap.gap >= 0;
  const monthTitle = new Date().toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

  return (
    <section
      className="w-full px-4 pt-2 pb-1 shrink-0 space-y-2 relative z-20 sm:space-y-3 sm:pt-3 sm:pb-2"
      aria-label="Dashboard statistieken"
    >
      <div>
        <h2 className="mb-1.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase leading-tight sm:mb-2 sm:text-[11px]">
          <span className="sm:hidden">Deze week vs. gem. 2 wkn</span>
          <span className="hidden sm:inline">
            Deze week t.o.v. gemiddelde vorige 2 weken
          </span>
        </h2>
        <div className="flex flex-row gap-2 sm:gap-3">
          <WeeklyStatBlock
            label="Gewerkte uren"
            primaryValue={formatHoursOneDecimal(weekly.thisWeekHours)}
            primarySuffix="uur"
            avgLabel={`vs. ${hoursAvg} uur gemiddeld`}
            pct={weekly.hoursPct}
            trend={weekly.hoursTrend}
          />
          <WeeklyStatBlock
            label="Omzet"
            primaryValue={formatEur(weekly.thisWeekRevenue)}
            primarySuffix={null}
            avgLabel={`vs. ${revAvg} gemiddeld`}
            pct={weekly.revenuePct}
            trend={weekly.revenueTrend}
          />
        </div>
      </div>

      <div className={widgetCardClass}>
        <p className="text-[10px] font-semibold tracking-wide text-gray-600 uppercase sm:text-[11px]">
          Resultaat {monthTitle}
        </p>
        <div className="mt-0.5 flex items-start justify-between gap-2 sm:mt-1">
          <div className="min-w-0">
            <p
              className={`text-lg font-bold leading-tight sm:text-2xl ${
                gapPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatEur(monthGap.gap)}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-gray-500 sm:mt-1.5 sm:text-xs">
              Onkosten {formatEur(monthGap.expenses)} · Verdiensten{" "}
              {formatEur(monthGap.earnings)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
