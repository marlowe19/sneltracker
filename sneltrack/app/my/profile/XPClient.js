"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Fire, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "@carbon/icons-react";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

function formatHours(hours) {
  return (
    new Intl.NumberFormat("nl-NL", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(hours ?? 0) + " uur"
  );
}

const BREAKDOWN_LABELS = {
  volume: "Volume",
  value: "Waarde",
  growth: "Groei",
  consistency: "Consistentie",
};

const PERIOD_OPTIONS = [
  { value: "day", label: "Dag" },
  { value: "week", label: "Week" },
  { value: "month", label: "Maand" },
  { value: "year", label: "Jaar" },
];

function getDateParam(period, refDate) {
  const d = new Date(refDate);
  if (period === "year") return String(d.getFullYear());
  if (period === "month")
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addPeriod(period, date, delta) {
  const d = new Date(date);
  switch (period) {
    case "day":
      d.setDate(d.getDate() + delta);
      break;
    case "week":
      d.setDate(d.getDate() + delta * 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + delta);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + delta);
      break;
    default:
      d.setMonth(d.getMonth() + delta);
  }
  return d;
}

export default function XPClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [period, setPeriod] = useState("month");
  const [refDate, setRefDate] = useState(() => new Date());

  const fetchXP = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dateParam = getDateParam(period, refDate);
      const res = await fetch(
        `/my/api/xp?period=${period}&date=${dateParam}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Kon XP niet ophalen");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, refDate]);

  useEffect(() => {
    fetchXP();
  }, [fetchXP]);

  function handlePrev() {
    setRefDate((d) => addPeriod(period, d, -1));
  }

  function handleNext() {
    const next = addPeriod(period, refDate, 1);
    if (next > new Date() && period !== "day") return;
    setRefDate(next);
  }

  const nextPeriodStart = addPeriod(period, refDate, 1);
  const canGoNext = nextPeriodStart <= new Date();

  if (loading && !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-3 bg-gray-100 rounded w-full mt-2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  const { totalXP, breakdown, inputs, streak, streakBonuses, lifetimeXP, periodLabel } =
    data || {};

  return (
    <main className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">XP</h2>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-gray-50 text-gray-700"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
            aria-label="Vorige periode"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium text-gray-700 truncate flex-1 text-center">
            {periodLabel || "—"}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Volgende periode"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-baseline gap-2 mt-4">
          <span className="text-2xl font-bold text-gray-900">{totalXP ?? 0}</span>
          <span className="text-sm text-gray-500">XP</span>
        </div>

        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          <span className="text-xs">Totaal: {lifetimeXP ?? 0} XP</span>
          {(streak?.daily > 0 || streak?.weekly > 0) && (
            <span className="flex items-center gap-1">
              <Fire size={14} className="text-orange-500" />
              {streak.daily > 0 && `${streak.daily}d`}
              {streak.daily > 0 && streak.weekly > 0 && " · "}
              {streak.weekly > 0 && `${streak.weekly}w`}
            </span>
          )}
        </div>

        {(streakBonuses?.daily > 0 || streakBonuses?.weekly > 0) && (
          <div className="mt-2 text-xs text-amber-600">
            Streak bonus: +{(streakBonuses.daily || 0) + (streakBonuses.weekly || 0)} XP
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="mt-4 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          {showBreakdown ? "Verberg" : "Toon"} berekening
          {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showBreakdown && breakdown && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <p className="text-xs text-gray-500 mb-2">
              {periodLabel} · {formatHours(inputs?.total_hours)} ·{" "}
              {formatMoney(inputs?.total_revenue)}
            </p>
            {Object.entries(breakdown).map(([key, item]) => (
              <div key={key} className="flex justify-between items-baseline text-sm">
                <span className="text-gray-600">
                  {BREAKDOWN_LABELS[key] || key}: {item.formula}
                </span>
                <span className="font-medium text-gray-900">{item.xp} XP</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
