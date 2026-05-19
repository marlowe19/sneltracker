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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${palette}`}
    >
      <Icon size={14} aria-hidden />
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
    <div className="relative min-w-0 flex-1 pl-3 border-l-4 border-violet-500 rounded-r-xl bg-white py-3 pr-3">
      <p className="text-[11px] font-semibold tracking-wide text-gray-600 uppercase">
        {label}
      </p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none text-[#008eff]">
            {primaryValue}
            {primarySuffix ? (
              <span className="ml-1 text-base font-semibold text-gray-600">
                {primarySuffix}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-xs text-gray-500">{avgLabel}</p>
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
      <section className="w-full px-4 pt-3 pb-2 shrink-0">
        <div className="flex justify-center py-6">
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
      className="w-full px-4 pt-3 pb-2 shrink-0 space-y-3 relative z-20 bg-white border-b border-gray-100"
      aria-label="Dashboard statistieken"
    >
      <div>
        <h2 className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase mb-2">
          Deze week t.o.v. gemiddelde vorige 2 weken
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
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

      <div className="relative rounded-r-xl bg-white py-3 pl-3 pr-3 border-l-4 border-violet-500">
        <p className="text-[11px] font-semibold tracking-wide text-gray-600 uppercase">
          Resultaat {monthTitle}
        </p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`text-2xl font-bold leading-tight ${
                gapPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatEur(monthGap.gap)}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 leading-snug">
              Onkosten {formatEur(monthGap.expenses)} · Verdiensten{" "}
              {formatEur(monthGap.earnings)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
