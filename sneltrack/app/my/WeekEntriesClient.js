"use client";

import { useEffect, useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import {
  getWeekBounds,
  toIso,
  computeEntryDurationMsClipped,
} from "@/lib/time";
import { getWeek } from "date-fns";
import Link from "next/link";
import DayClickableClient from "./DayClickableClient";
import NotificationBadge from "@/app/components/NotificationBadge";
import { computeEntryBillableMoney } from "@/lib/finance/entryEarnings";

function formatHoursHMM(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function WeekEntriesClient({ user, weekOffset }) {
  const entries = useStore((state) => state.entries);
  const loadingEntries = useStore((state) => state.loadingEntries);
  const fetchWeekEntries = useStore((state) => state.fetchWeekEntries);
  const weekExpenses = useStore((state) => state.weekExpenses);
  const fetchWeekExpenses = useStore((state) => state.fetchWeekExpenses);
  const storeWeekOffset = useStore((state) => state.weekOffset);
  const setWeekOffset = useStore((state) => state.setWeekOffset);

  // State for notes with due dates
  const [notesWithDueDatePerDay, setNotesWithDueDatePerDay] = useState(
    Array(7).fill(false),
  );
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isWeekSummaryExpanded, setIsWeekSummaryExpanded] = useState(false);

  // Sync weekOffset with store
  useEffect(() => {
    if (storeWeekOffset !== weekOffset) {
      setWeekOffset(weekOffset);
    }
  }, [weekOffset, storeWeekOffset, setWeekOffset]);

  useEffect(() => {
    // Calculate week bounds ONCE
    const referenceDate = new Date(
      new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000,
    );
    const { start: weekStart, end: weekEnd } = getWeekBounds(referenceDate);
    const weekStartIso = toIso(weekStart);
    const weekEndIso = toIso(weekEnd);

    // Fetch both entries and expenses together
    fetchWeekEntries(user, weekStartIso, weekEndIso);
    fetchWeekExpenses(user, weekStartIso, weekEndIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekOffset]);

  // Calculate week bounds for rendering
  const referenceDate = new Date(
    new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000,
  );
  const { start: weekStart, end: weekEnd } = getWeekBounds(referenceDate);
  const weekNumber = getWeek(weekStart, { weekStartsOn: 1 });

  // Memoize date strings to prevent infinite loops
  // Calculate dates inside useMemo to avoid Date object dependencies
  const weekStartIso = useMemo(() => {
    const refDate = new Date(
      new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000,
    );
    const { start } = getWeekBounds(refDate);
    return start.toISOString().split("T")[0];
  }, [weekOffset]);

  const weekEndIso = useMemo(() => {
    const refDate = new Date(
      new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000,
    );
    const { end } = getWeekBounds(refDate);
    return end.toISOString().split("T")[0];
  }, [weekOffset]);

  // Fetch notes with due dates in the week
  useEffect(() => {
    async function fetchNotesWithDueDates() {
      if (!user || isLoadingNotes) return;

      setIsLoadingNotes(true);
      try {
        const url = new URL(`/my/notes/api`, window.location.origin);
        url.searchParams.set("startDate", weekStartIso);
        url.searchParams.set("endDate", weekEndIso);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch notes: ${res.status}`);
        }

        const data = await res.json();
        const notes = data.notes || [];

        // Calculate which days have notes with due dates
        const hasNotePerDay = Array(7).fill(false);
        for (const note of notes) {
          if (note.due_date) {
            const dueDate = new Date(note.due_date);
            // Reset time to start of day for comparison
            dueDate.setHours(0, 0, 0, 0);
            const weekStartOnly = new Date(weekStart);
            weekStartOnly.setHours(0, 0, 0, 0);
            const weekEndOnly = new Date(weekEnd);
            weekEndOnly.setHours(23, 59, 59, 999);

            // Check if due date falls within the week
            if (dueDate >= weekStartOnly && dueDate <= weekEndOnly) {
              // Find which day of the week (0 = Monday, 6 = Sunday)
              const dayOfWeek = dueDate.getDay();
              const dayIndex = (dayOfWeek + 6) % 7; // Convert to Monday=0
              if (dayIndex >= 0 && dayIndex < 7) {
                hasNotePerDay[dayIndex] = true;
              }
            }
          }
        }

        // Only update state if data actually changed
        setNotesWithDueDatePerDay((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(hasNotePerDay)) {
            return prev;
          }
          return hasNotePerDay;
        });
      } catch (err) {
        console.error("Error fetching notes with due dates:", err);
        // On error, set all to false
        setNotesWithDueDatePerDay(Array(7).fill(false));
      } finally {
        setIsLoadingNotes(false);
      }
    }

    fetchNotesWithDueDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStartIso, weekEndIso]);

  // Calculate perDay, perDayMoney, and perDayExpenses
  const perDay = Array(7).fill(0);
  const perDayMoney = Array(7).fill(0);
  const perDayExpenses = Array(7).fill(0);

  for (const e of entries) {
    // Calculate duration clipped to week bounds (duration_ms takes precedence)
    const duration = computeEntryDurationMsClipped(
      e.start_time,
      e.end_time,
      weekStart,
      weekEnd,
      e.duration_ms ?? null,
    );

    // Only process entries that have duration within the week
    if (duration === 0) continue;

    // Determine which day to assign this entry to
    let dayIndex = -1;

    // If entry has duration_ms, use start_time to determine the day
    // (start_time should be set to the start of the day when duration_ms is set)
    if (e.duration_ms !== null && e.duration_ms !== undefined && e.start_time) {
      const entryStart = new Date(e.start_time);
      const dow = entryStart.getDay();
      dayIndex = (dow + 6) % 7; // Monday=0
    } else {
      // For time-based entries, use the start time to determine the day
      const entryStart = new Date(e.start_time);
      // Use the clipped start time if entry starts before the week
      const clippedStart = entryStart > weekStart ? entryStart : weekStart;
      const dow = clippedStart.getDay();
      dayIndex = (dow + 6) % 7; // Monday=0
    }

    if (dayIndex >= 0 && dayIndex < 7) {
      perDay[dayIndex] += duration;

      // Calculate money for this entry (billable only)
      perDayMoney[dayIndex] += computeEntryBillableMoney(e, duration);
    }
  }

  // Calculate per-day expenses
  for (const expense of weekExpenses) {
    if (expense.date) {
      const expenseDate = new Date(expense.date);
      const dow = expenseDate.getDay();
      const dayIndex = (dow + 6) % 7; // Monday=0

      if (dayIndex >= 0 && dayIndex < 7) {
        const price = expense.price || 0;
        perDayExpenses[dayIndex] += price;
      }
    }
  }

  const weekTotalTime = perDay.reduce((sum, val) => sum + val, 0);
  const weekTotalMoney = perDayMoney.reduce((sum, val) => sum + val, 0);
  const weekTotalExpenses = perDayExpenses.reduce((sum, val) => sum + val, 0);

  // Calculate individual totals (only user's own entries)
  let myWeekTotalTime = 0;
  let myWeekTotalMoney = 0;
  let myWeekTotalExpenses = 0;

  for (const e of entries) {
    // Only count entries belonging to the current user
    if (e.user_name !== user) continue;

    const duration = computeEntryDurationMsClipped(
      e.start_time,
      e.end_time,
      weekStart,
      weekEnd,
      e.duration_ms ?? null,
    );

    if (duration === 0) continue;

    myWeekTotalTime += duration;

    myWeekTotalMoney += computeEntryBillableMoney(e, duration);
  }

  // Calculate individual expenses (only user's own expenses)
  for (const expense of weekExpenses) {
    if (expense.user_name === user && expense.date) {
      const price = expense.price || 0;
      myWeekTotalExpenses += price;
    }
  }

  // Check if there's a difference (entries from other users in shared projects)
  const hasOtherUsersEntries =
    myWeekTotalTime !== weekTotalTime ||
    myWeekTotalMoney !== weekTotalMoney ||
    myWeekTotalExpenses !== weekTotalExpenses;
  const perUserWeekTotalsMap = new Map();

  for (const e of entries) {
    const duration = computeEntryDurationMsClipped(
      e.start_time,
      e.end_time,
      weekStart,
      weekEnd,
      e.duration_ms ?? null,
    );

    if (duration === 0) continue;

    const userName = e.user_name || "Onbekend";
    if (!perUserWeekTotalsMap.has(userName)) {
      perUserWeekTotalsMap.set(userName, {
        userName,
        displayName: e.user_display_name || userName,
        timeMs: 0,
        money: 0,
        expenses: 0,
      });
    }

    const userTotals = perUserWeekTotalsMap.get(userName);
    userTotals.timeMs += duration;
    userTotals.money += computeEntryBillableMoney(e, duration);
  }

  for (const expense of weekExpenses) {
    const expenseUserName = expense.user_name;
    if (!expenseUserName || !perUserWeekTotalsMap.has(expenseUserName))
      continue;
    const userTotals = perUserWeekTotalsMap.get(expenseUserName);
    userTotals.expenses += expense.price || 0;
  }

  const perUserWeekTotals = Array.from(perUserWeekTotalsMap.values()).sort(
    (a, b) => b.timeMs - a.timeMs,
  );
  const weekSummaryDetailsId = "week-summary-details";
  const weekSummaryGridCols =
    "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px]";

  // Show spinner while loading
  if (loadingEntries) {
    return (
      <section className="w-full shrink-0 border-b border-gray-200 pb-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
          <span className="ml-3 text-gray-600">Laden...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full shrink-0 border-t border-b border-gray-200 px-4">
      <div className="flex items-center justify-between mb-1">
        <Link
          href={`/my?w=${weekOffset - 1}`}
          className=" rounded-full text-gray-600 hover:bg-gray-100 text-5xl sm:text-4xl min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center"
          aria-label="Previous week"
        >
          ‹
        </Link>
        <Link
          href={`/my?w=0`}
          className="px-2  sm:px-1 p-1 sm:py-1 mt-[10px] rounded-full border text-sm text-gray-700 hover:bg-gray-100  flex items-center justify-center"
          aria-label="Ga naar deze week"
        >
          Vandaag:{" "}
          {new Date().toLocaleDateString("nl-NL", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Link>
        <Link
          href={`/my?w=${weekOffset + 1}`}
          className="rounded-full text-gray-600 hover:bg-gray-100 text-5xl sm:text-4xl min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center"
          aria-label="Next week"
        >
          ›
        </Link>
      </div>
      <div className="w-full min-w-0 overflow-x-auto">
        <div
          className="week grid gap-1 items-start"
          style={{ gridTemplateColumns: "repeat(7, minmax(75px, 1fr))" }}
        >
          {[
            "Maandag",
            "Dinsdag",
            "Woensdag",
            "Donderdag",
            "Vrijdag",
            "Zaterdag",
            "Zondag",
          ].map((d, i) => {
            const dayDate = new Date(
              weekStart.getTime() + i * 24 * 60 * 60 * 1000,
            );
            const isToday =
              new Date().toDateString() === dayDate.toDateString();
            return (
              <DayClickableClient
                key={d}
                dayDate={dayDate}
                isToday={isToday}
                dayLabel={d}
                dayNumber={dayDate.getDate()}
                dayIndex={i}
                hours={perDay[i]}
                money={perDayMoney[i]}
                expenses={perDayExpenses[i]}
                user={user}
              >
                <div className="day-label text-sm tracking-wide text-gray-500 uppercase whitespace-nowrap w-full text-center mb-1">
                  <span className="sm:hidden">
                    {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][i]}
                  </span>
                  <span className="hidden sm:inline">{d.slice(0, 3)}</span>
                </div>
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mb-1 mx-auto ${
                    isToday
                      ? "bg-[#008eff] text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {dayDate.getDate()}
                  {notesWithDueDatePerDay[i] && (
                    <NotificationBadge
                      user={user}
                      className="w-[30px] h-[30px]"
                      iconSize={30}
                      style={{ marginTop: "-13px", marginRight: "-7px" }}
                    />
                  )}
                </div>
                <div className="day-hours text-xs font-bold mb-0.5 tabular-nums min-h-4 w-full text-center">
                  {perDay[i] ? formatHoursHMM(perDay[i]) : "0:00"}
                </div>

                <div
                  className={`day-money text-[10px] font-medium text-gray-600 tabular-nums min-h-3.5 w-full text-center ${
                    perDayMoney[i] > 0 ? "" : "invisible"
                  }`}
                >
                  {perDayMoney[i] > 0 ? formatMoney(perDayMoney[i]) : "\u200B"}
                </div>
                <div
                  className={`day-expenses text-[10px] font-medium text-red-500 tabular-nums min-h-3.5 w-full text-center ${
                    perDayExpenses[i] > 0 ? "" : "invisible"
                  }`}
                >
                  {perDayExpenses[i] > 0
                    ? formatMoney(perDayExpenses[i])
                    : "\u200B"}
                </div>
                <div className="sr-only">
                  <span className="sm:hidden">
                    {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][i]}
                  </span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              </DayClickableClient>
            );
          })}
        </div>
      </div>
      <div className="w-full mt-2 bg-white shadow-[inset_0px_1px_0px_0px_rgba(240,240,240,1.00)]">
        <button
          type="button"
          className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
          onClick={() => setIsWeekSummaryExpanded((prev) => !prev)}
          aria-expanded={isWeekSummaryExpanded}
          aria-controls={weekSummaryDetailsId}
        >
          <div className={`grid ${weekSummaryGridCols} items-start gap-2`}>
            <div className="flex flex-col justify-center items-start gap-0.5">
              <div className="text-gray-900 text-xs font-bold font-sans">
                Week {weekNumber}
              </div>
              <div className="text-gray-900 text-xs font-bold font-sans">
                Totaal
              </div>
            </div>
            <div className="flex flex-col justify-center items-end gap-0.5 text-right">
              <div className="text-[#808080] text-xs font-bold font-sans">
                Tijd
              </div>
              <div className="text-gray-900 text-xs font-bold font-sans tabular-nums">
                {formatHoursHMM(weekTotalTime)}
              </div>
            </div>
            <div className="flex flex-col justify-center items-end gap-0.5 text-right">
              <div className="text-[#808080] text-xs font-bold font-sans">
                Euro&apos;s
              </div>
              <div className="text-teal-500 text-xs font-bold font-sans tabular-nums">
                {formatMoney(weekTotalMoney)}
              </div>
            </div>
            <div className="flex flex-col justify-center items-end gap-0.5 text-right">
              <div className="text-[#808080] text-xs font-bold font-sans">
                Uitgaven
              </div>
              <div className="text-red-500 text-xs font-bold font-sans tabular-nums">
                {formatMoney(weekTotalExpenses)}
              </div>
            </div>
            <div
              className={`text-gray-400 text-xs font-bold pt-0.5 transition-transform duration-300 ${
                isWeekSummaryExpanded ? "rotate-180" : "rotate-0"
              }`}
              aria-hidden="true"
            >
              ▼
            </div>
          </div>
        </button>

        <div
          id={weekSummaryDetailsId}
          className={`grid transition-all duration-300 ease-out ${
            isWeekSummaryExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-3 py-2">
              <div className="flex flex-col gap-1">
                {perUserWeekTotals.map((userTotals) => (
                  <div
                    key={userTotals.userName}
                    className={`grid ${weekSummaryGridCols} gap-2 text-xs font-bold font-sans`}
                  >
                    <div className="text-gray-700 truncate">
                      {userTotals.displayName}
                    </div>
                    <div className="text-right text-gray-900 tabular-nums">
                      {formatHoursHMM(userTotals.timeMs)}
                    </div>
                    <div className="text-right text-teal-500 tabular-nums">
                      {formatMoney(userTotals.money)}
                    </div>
                    <div className="text-right text-red-500 tabular-nums">
                      {formatMoney(userTotals.expenses)}
                    </div>
                    <div aria-hidden="true"></div>
                  </div>
                ))}
                {perUserWeekTotals.length === 0 && (
                  <div className="text-xs text-gray-500 py-1">
                    Geen uren gelogd deze week.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* <div className="w-full px-4 py-4 mt-4 flex justify-center">
        <Link
          href="/my/wrapped"
          className="w-full max-w-md px-6 py-4 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-xl hover:from-purple-600 hover:via-pink-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
          aria-label="2025 Wrapped"
        >
          <span className="text-2xl">🎉</span>
          <span>2025 Wrapped</span>
        </Link>
      </div> */}
    </section>
  );
}
