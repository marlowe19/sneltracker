"use client";

import { useState, useEffect, useCallback } from "react";

const TABS = [
  { value: "week", label: "7 dagen" },
  { value: "month", label: "Huidige maand" },
  { value: "year", label: "Alles" },
];

function getDateParam(period) {
  const d = new Date();
  if (period === "year") return `${d.getFullYear()}`;
  if (period === "month")
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function RankDisplay({ rank }) {
  const isTopThree = rank <= 3;
  const rankClass =
    rank === 1
      ? "font-bold text-lg text-amber-500"
      : rank === 2
        ? "font-bold text-lg text-slate-400"
        : rank === 3
          ? "font-bold text-lg text-orange-400"
          : "font-medium text-base text-slate-500";

  return (
    <div className={`flex items-center justify-center w-8 h-8 shrink-0 ${rankClass}`}>
      {rank}
    </div>
  );
}

export default function LeaderboardClient({ currentUserId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("month");

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dateParam = getDateParam(period);
      const res = await fetch(
        `/my/api/leaderboard?period=${period}&date=${dateParam}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Kon leaderboard niet ophalen");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const currentUserEntry = data?.entries?.find((e) => e.user_name === currentUserId);

  if (loading && !data) {
    return (
      <div className="p-4 space-y-4 min-h-[200px]">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="p-4 space-y-4">
        {/* Time period tabs */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPeriod(tab.value)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center border-b-2 pb-3 pt-2 text-sm font-bold transition-colors ${
                period === tab.value
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Current user card */}
        {currentUserEntry && (
          <div
            className="p-4 bg-white rounded-xl border border-slate-200 border-l-4 border-l-blue-500 flex items-center gap-4"
            style={{ animation: "fade-in 0.3s ease-out" }}
          >
            <RankDisplay rank={currentUserEntry.rank} />
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
              {getInitials(currentUserEntry.display_name)}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <p className="text-slate-900 text-base font-semibold truncate">
                {currentUserEntry.display_name}
              </p>
              {data.topPercent != null && (
                <p className="text-xs text-slate-500">Top {data.topPercent}%</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="inline-block px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded mb-1">
                JIJ
              </span>
              <p className="text-blue-600 text-base font-bold">
                {currentUserEntry.totalXP.toLocaleString("nl-NL")} XP
              </p>
            </div>
          </div>
        )}

        {/* GLOBALE RANKING */}
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Globale ranking
        </h3>

        {!data?.entries?.length ? (
          <p className="text-gray-600 text-sm py-8 text-center">
            Nog geen gegevens voor deze periode
          </p>
        ) : (
          <div className="space-y-3">
            {data.entries
              .filter((e) => e.user_name !== currentUserId)
              .map((entry, index) => {
                const isTopThree = entry.rank <= 3;
                const cardOpacity =
                  entry.rank >= 6 ? "opacity-80" : entry.rank >= 4 ? "opacity-90" : "";
                return (
                  <div
                    key={entry.user_name}
                    className={`p-4 bg-white rounded-xl border border-slate-200 flex items-center gap-4 ${cardOpacity}`}
                    style={{
                      animation: "fade-in 0.3s ease-out both",
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <RankDisplay rank={entry.rank} />
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
                      {getInitials(entry.display_name)}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <p
                        className={`text-slate-900 truncate ${
                          isTopThree ? "text-base font-semibold" : "text-base font-medium"
                        }`}
                      >
                        {entry.display_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-blue-600 text-base font-bold">
                        {entry.totalXP.toLocaleString("nl-NL")} XP
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
