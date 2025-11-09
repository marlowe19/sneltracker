"use client";

import { useEffect, useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import {
  getWeekBounds,
  toIso,
  computeEntryDurationMsClipped,
} from "@/lib/time";
import Link from "next/link";
import DayClickableClient from "./DayClickableClient";
import NotificationBadge from "@/app/components/NotificationBadge";

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
  const projects = useStore((state) => state.projects);

  // State for notes with due dates
  const [notesWithDueDatePerDay, setNotesWithDueDatePerDay] = useState(
    Array(7).fill(false)
  );
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Sync weekOffset with store
  useEffect(() => {
    if (storeWeekOffset !== weekOffset) {
      setWeekOffset(weekOffset);
    }
  }, [weekOffset, storeWeekOffset, setWeekOffset]);

  useEffect(() => {
    // Calculate week bounds ONCE
    const referenceDate = new Date(
      new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000
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
    new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000
  );
  const { start: weekStart, end: weekEnd } = getWeekBounds(referenceDate);

  // Memoize date strings to prevent infinite loops
  // Calculate dates inside useMemo to avoid Date object dependencies
  const weekStartIso = useMemo(() => {
    const refDate = new Date(
      new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000
    );
    const { start } = getWeekBounds(refDate);
    return start.toISOString().split("T")[0];
  }, [weekOffset]);

  const weekEndIso = useMemo(() => {
    const refDate = new Date(
      new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000
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
        const url = new URL(
          `/${encodeURIComponent(user)}/notes/api`,
          window.location.origin
        );
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
      e.duration_ms ?? null
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

      // Calculate money for this entry
      if (e.hourly_rate) {
        const hours = duration / (1000 * 60 * 60);
        const money = hours * e.hourly_rate;
        perDayMoney[dayIndex] += money;
      }
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

  const maxMs = Math.max(1, ...perDay);
  const weekTotalTime = perDay.reduce((sum, val) => sum + val, 0);
  const weekTotalMoney = perDayMoney.reduce((sum, val) => sum + val, 0);
  const weekTotalExpenses = perDayExpenses.reduce((sum, val) => sum + val, 0);

  // Show spinner while loading
  if (loadingEntries) {
    return (
      <section className="w-full mt-auto pb-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
          <span className="ml-3 text-gray-600">Laden...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full mt-auto pb-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-1">
        <Link
          href={`/${encodeURIComponent(user)}?w=${weekOffset - 1}`}
          className=" rounded-full text-gray-600 hover:bg-gray-100 text-5xl sm:text-4xl min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center"
          aria-label="Previous week"
        >
          ‹
        </Link>
        <Link
          href={`/${encodeURIComponent(user)}?w=0`}
          className="px-2  sm:px-1 sm:py-1 mt-[10px] rounded-full border text-sm text-gray-700 hover:bg-gray-100 min-h-[44px] flex items-center justify-center"
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
          href={`/${encodeURIComponent(user)}?w=${weekOffset + 1}`}
          className="rounded-full text-gray-600 hover:bg-gray-100 text-5xl sm:text-4xl min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center"
          aria-label="Next week"
        >
          ›
        </Link>
      </div>
      <div className="w-full min-w-0 overflow-x-auto">
        <div className="week grid grid-cols-7 gap-1 items-start">
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
              weekStart.getTime() + i * 24 * 60 * 60 * 1000
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
                hours={perDay[i]}
                money={perDayMoney[i]}
                expenses={perDayExpenses[i]}
                user={user}
              >
                <div className="day-label text-[10px] tracking-wide text-gray-500 uppercase whitespace-nowrap w-full text-center mb-1">
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
                  className={`day-expenses text-[10px] font-medium text-green-600 tabular-nums min-h-3.5 w-full text-center ${
                    perDayExpenses[i] > 0 ? "" : "invisible"
                  }`}
                >
                  {perDayExpenses[i] > 0
                    ? formatMoney(perDayExpenses[i])
                    : "\u200B"}
                </div>
                <div
                  className={`day-money text-[10px] font-medium text-gray-600 tabular-nums min-h-3.5 w-full text-center ${
                    perDayMoney[i] > 0 ? "" : "invisible"
                  }`}
                >
                  {perDayMoney[i] > 0 ? formatMoney(perDayMoney[i]) : "\u200B"}
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
      <div className="pt-2 px-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">Week Totaal</div>
          <div className="flex items-center gap-4">
            <div className="text-sm tabular-nums">
              <span className="text-gray-600">Tijd: </span>
              <span className="font-medium">
                {formatHoursHMM(weekTotalTime)}
              </span>
            </div>
            {weekTotalMoney > 0 && (
              <div className="text-sm tabular-nums">
                <span className="text-gray-600">Peso&apos;s: </span>
                <span className="font-medium">
                  {formatMoney(weekTotalMoney)}
                </span>
              </div>
            )}
            {weekTotalExpenses > 0 && (
              <div className="text-sm tabular-nums">
                <span className="text-gray-600">Uitgaven: </span>
                <span className="font-medium text-green-600">
                  {formatMoney(weekTotalExpenses)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
