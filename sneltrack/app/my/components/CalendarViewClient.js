"use client";

import { useEffect, useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import {
  getWeekBounds,
  getMonthBounds,
  toIso,
  computeEntryDurationMsClipped,
} from "@/lib/time";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  format,
} from "date-fns";
import { nl } from "date-fns/locale/nl";
import NotificationBadge from "@/app/components/NotificationBadge";
import DayEntriesListClient from "./DayEntriesListClient";

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

function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function filterEntriesForDay(entries, dayDate) {
  if (!entries || !dayDate) return [];

  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);

  return entries.filter((entry) => {
    // For entries with duration_ms, check if start_time matches the day
    if (
      entry.duration_ms !== null &&
      entry.duration_ms !== undefined &&
      entry.start_time
    ) {
      const entryStart = new Date(entry.start_time);
      if (isSameDay(entryStart, dayDate)) {
        return true;
      }
    }

    // For time-based entries, check if entry starts on this day or overlaps
    const entryStart = new Date(entry.start_time);

    // Entry is on this day if it starts on this day
    if (isSameDay(entryStart, dayDate)) {
      return true;
    }

    // Also include entries that span multiple days if they overlap with this day
    const entryEnd = entry.end_time ? new Date(entry.end_time) : new Date();
    if (entryStart <= dayEnd && entryEnd >= dayStart) {
      return true;
    }

    return false;
  });
}

// Generate calendar days for month view
function generateMonthDays(referenceDate) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  const current = new Date(calendarStart);
  while (current <= calendarEnd) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return { days, monthStart, monthEnd };
}

export default function CalendarViewClient({
  user,
  viewType: initialViewType = "week",
  initialDate = new Date(),
  onDateSelect,
  isExpanded: initialIsExpanded = false,
  onClose,
  projectId,
}) {
  const [viewType, setViewType] = useState(initialViewType);
  const [referenceDate, setReferenceDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isExpanded, setIsExpanded] = useState(initialIsExpanded);

  const entries = useStore((state) => state.entries);
  const loadingEntries = useStore((state) => state.loadingEntries);
  const fetchWeekEntries = useStore((state) => state.fetchWeekEntries);
  const weekExpenses = useStore((state) => state.weekExpenses);
  const fetchWeekExpenses = useStore((state) => state.fetchWeekExpenses);
  const activeEntries = useStore((state) => state.activeEntries);
  const projects = useStore((state) => state.projects);
  const fetchProjects = useStore((state) => state.fetchProjects);

  // State for notes with due dates
  const [notesWithDueDatePerDay, setNotesWithDueDatePerDay] = useState({});
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Calculate date range based on view type
  const dateRange = useMemo(() => {
    if (viewType === "week") {
      return getWeekBounds(referenceDate);
    } else {
      return getMonthBounds(referenceDate);
    }
  }, [viewType, referenceDate]);

  // Fetch entries and expenses for the visible range
  useEffect(() => {
    const { start, end } = dateRange;
    const startIso = toIso(start);
    const endIso = toIso(end);

    fetchWeekEntries(user, startIso, endIso);
    fetchWeekExpenses(user, startIso, endIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, viewType, referenceDate, dateRange]);

  // Fetch projects if not already loaded
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch notes with due dates for the visible range
  useEffect(() => {
    async function fetchNotesWithDueDates() {
      if (!user || isLoadingNotes) return;

      setIsLoadingNotes(true);
      try {
        const { start, end } = dateRange;
        const startIso = start.toISOString().split("T")[0];
        const endIso = end.toISOString().split("T")[0];

        const url = new URL(
          `/${encodeURIComponent(user)}/notes/api`,
          window.location.origin
        );
        url.searchParams.set("startDate", startIso);
        url.searchParams.set("endDate", endIso);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch notes: ${res.status}`);
        }

        const data = await res.json();
        const notes = data.notes || [];

        // Calculate which days have notes with due dates
        const hasNotePerDay = {};
        for (const note of notes) {
          if (note.due_date) {
            const dueDate = new Date(note.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const dateKey = dueDate.toISOString().split("T")[0];
            hasNotePerDay[dateKey] = true;
          }
        }

        setNotesWithDueDatePerDay(hasNotePerDay);
      } catch (err) {
        console.error("Error fetching notes with due dates:", err);
        setNotesWithDueDatePerDay({});
      } finally {
        setIsLoadingNotes(false);
      }
    }

    fetchNotesWithDueDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateRange]);

  // Prevent body scrolling when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isExpanded]);

  // Merge activeEntries with entries
  const allEntries = useMemo(() => {
    const merged = [...entries];
    activeEntries.forEach((activeEntry) => {
      if (!merged.find((e) => e.id === activeEntry.id)) {
        merged.push(activeEntry);
      }
    });
    return merged;
  }, [entries, activeEntries]);

  // Calculate per-day data
  const perDayData = useMemo(() => {
    const data = {};
    const { start, end } = dateRange;

    // Generate all days in the range
    const days = [];
    if (viewType === "week") {
      for (let i = 0; i < 7; i++) {
        const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        days.push(day);
      }
    } else {
      const monthDays = generateMonthDays(referenceDate);
      days.push(...monthDays.days);
    }

    // Initialize data for each day
    days.forEach((day) => {
      const dateKey = day.toISOString().split("T")[0];
      data[dateKey] = {
        date: day,
        hours: 0,
        money: 0,
        expenses: 0,
        entries: [],
      };
    });

    // Process entries
    for (const e of allEntries) {
      const duration = computeEntryDurationMsClipped(
        e.start_time,
        e.end_time,
        start,
        end,
        e.duration_ms ?? null
      );

      if (duration === 0) continue;

      // Determine which day to assign this entry to
      let dayDate = null;
      if (
        e.duration_ms !== null &&
        e.duration_ms !== undefined &&
        e.start_time
      ) {
        dayDate = new Date(e.start_time);
      } else {
        const entryStart = new Date(e.start_time);
        const clippedStart = entryStart > start ? entryStart : start;
        dayDate = clippedStart;
      }

      dayDate.setHours(0, 0, 0, 0);
      const dateKey = dayDate.toISOString().split("T")[0];

      if (data[dateKey]) {
        data[dateKey].hours += duration;
        data[dateKey].entries.push(e);

        if (e.hourly_rate) {
          const hours = duration / (1000 * 60 * 60);
          const money = hours * e.hourly_rate;
          data[dateKey].money += money;
        }
      }
    }

    // Process expenses
    for (const expense of weekExpenses) {
      if (expense.date) {
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);
        const dateKey = expenseDate.toISOString().split("T")[0];

        if (data[dateKey]) {
          const price = expense.price || 0;
          data[dateKey].expenses += price;
        }
      }
    }

    return data;
  }, [allEntries, weekExpenses, dateRange, viewType, referenceDate]);

  // Calculate totals based on current view
  const viewTotals = useMemo(() => {
    let totalTime = 0;
    let totalMoney = 0;
    let totalExpenses = 0;

    if (viewType === "week") {
      // Sum totals for the 7 days in the week
      const { start: weekStart } = getWeekBounds(referenceDate);
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = dayDate.toISOString().split("T")[0];
        const dayData = perDayData[dateKey];
        if (dayData) {
          totalTime += dayData.hours || 0;
          totalMoney += dayData.money || 0;
          totalExpenses += dayData.expenses || 0;
        }
      }
    } else {
      // Sum totals for all days in the current month (excluding padding days)
      const { days, monthStart } = generateMonthDays(referenceDate);
      days.forEach((dayDate) => {
        // Only include days that are in the current month
        if (dayDate.getMonth() === monthStart.getMonth()) {
          const dateKey = dayDate.toISOString().split("T")[0];
          const dayData = perDayData[dateKey];
          if (dayData) {
            totalTime += dayData.hours || 0;
            totalMoney += dayData.money || 0;
            totalExpenses += dayData.expenses || 0;
          }
        }
      });
    }

    return { totalTime, totalMoney, totalExpenses };
  }, [perDayData, viewType, referenceDate]);

  const handleDateClick = (dayDate, e) => {
    if (e) {
      e.stopPropagation(); // Prevent bubbling to section's onClick
    }
    setSelectedDate(dayDate);
    setIsExpanded(true); // Immediately expand when a date is clicked
    if (onDateSelect) {
      onDateSelect(dayDate);
    }
  };

  const handlePrevious = () => {
    if (viewType === "week") {
      setReferenceDate((prev) => subWeeks(prev, 1));
    } else {
      setReferenceDate((prev) => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewType === "week") {
      setReferenceDate((prev) => addWeeks(prev, 1));
    } else {
      setReferenceDate((prev) => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setReferenceDate(today);
    setSelectedDate(today);
  };

  const handleViewToggle = () => {
    setViewType((prev) => (prev === "week" ? "month" : "week"));
  };

  const handleComponentClick = () => {
    if (selectedDate) {
      setIsExpanded(true);
    }
  };

  const handleCloseExpanded = (e) => {
    e.stopPropagation();
    setIsExpanded(false);
    if (onClose) {
      onClose();
    }
  };

  // Get selected date entries
  const selectedDateEntries = useMemo(() => {
    if (!selectedDate) return [];
    return filterEntriesForDay(allEntries, selectedDate);
  }, [selectedDate, allEntries]);

  // Get selected date expenses
  const selectedDateExpenses = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split("T")[0];
    return weekExpenses.filter((expense) => {
      if (!expense.date) return false;
      const expenseDate = new Date(expense.date);
      expenseDate.setHours(0, 0, 0, 0);
      return expenseDate.toISOString().split("T")[0] === dateKey;
    });
  }, [selectedDate, weekExpenses]);

  // Render week view
  const renderWeekView = () => {
    const { start: weekStart } = getWeekBounds(referenceDate);
    const dayLabels = [
      "Maandag",
      "Dinsdag",
      "Woensdag",
      "Donderdag",
      "Vrijdag",
      "Zaterdag",
      "Zondag",
    ];
    const dayLabelsShort = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

    return (
      <div className="w-full min-w-0 overflow-x-auto z-55">
        <div
          className="week grid gap-1 items-start"
          style={{ gridTemplateColumns: "repeat(7, minmax(75px, 1fr))" }}
        >
          {dayLabels.map((d, i) => {
            const dayDate = new Date(
              weekStart.getTime() + i * 24 * 60 * 60 * 1000
            );
            const dateKey = dayDate.toISOString().split("T")[0];
            const dayData = perDayData[dateKey] || {
              hours: 0,
              money: 0,
              expenses: 0,
            };
            const isToday = isSameDay(dayDate, new Date());
            const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
            const hasNote = notesWithDueDatePerDay[dateKey];

            return (
              <div
                key={d}
                className={`day relative flex flex-col items-center w-full cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition-colors ${
                  isSelected ? "bg-blue-100" : ""
                }`}
                onClick={(e) => handleDateClick(dayDate, e)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDateClick(dayDate, e);
                  }
                }}
                aria-label={`Select ${d}`}
              >
                <div className="day-label text-sm tracking-wide text-gray-500 uppercase whitespace-nowrap w-full text-center mb-1">
                  <span className="sm:hidden">{dayLabelsShort[i]}</span>
                  <span className="hidden sm:inline">{d.slice(0, 3)}</span>
                </div>
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mb-1 mx-auto ${
                    isToday
                      ? "bg-[#008eff] text-white"
                      : isSelected
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {dayDate.getDate()}
                  {hasNote && (
                    <NotificationBadge
                      user={user}
                      className="w-[30px] h-[30px]"
                      iconSize={30}
                      style={{ marginTop: "-13px", marginRight: "-7px" }}
                    />
                  )}
                </div>
                <div className="day-hours text-xs font-bold mb-0.5 tabular-nums min-h-4 w-full text-center">
                  {dayData.hours ? formatHoursHMM(dayData.hours) : "0:00"}
                </div>
                {/* <div
                  className={`day-expenses text-[10px] font-medium text-green-600 tabular-nums min-h-3.5 w-full text-center ${
                    dayData.expenses > 0 ? "" : "invisible"
                  }`}
                >
                  {dayData.expenses > 0
                    ? formatMoney(dayData.expenses)
                    : "\u200B"}
                </div> */}
                <div
                  className={`day-money text-[10px] font-medium text-gray-600 tabular-nums min-h-3.5 w-full text-center ${
                    dayData.money > 0 ? "" : "invisible"
                  }`}
                >
                  {dayData.money > 0 ? formatMoney(dayData.money) : "\u200B"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render month view
  const renderMonthView = () => {
    const { days, monthStart } = generateMonthDays(referenceDate);
    const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

    return (
      <div className="w-full">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayLabels.map((label) => (
            <div
              key={label}
              className="text-xs font-medium text-gray-500 uppercase text-center py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((dayDate, index) => {
            const dateKey = dayDate.toISOString().split("T")[0];
            const dayData = perDayData[dateKey] || {
              hours: 0,
              money: 0,
              expenses: 0,
            };
            const isToday = isSameDay(dayDate, new Date());
            const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
            const isCurrentMonth = dayDate.getMonth() === monthStart.getMonth();
            const hasNote = notesWithDueDatePerDay[dateKey];

            return (
              <div
                key={index}
                className={`day relative flex flex-col items-center min-h-[60px] cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition-colors ${
                  !isCurrentMonth ? "opacity-40" : ""
                } ${isSelected ? "bg-blue-100" : ""}`}
                onClick={(e) => handleDateClick(dayDate, e)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDateClick(dayDate, e);
                  }
                }}
                aria-label={`Select ${dayDate.toLocaleDateString()}`}
              >
                <div
                  className={`relative flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-0.5 ${
                    isToday
                      ? "bg-[#008eff] text-white"
                      : isSelected
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {dayDate.getDate()}
                  {hasNote && (
                    <NotificationBadge
                      user={user}
                      className="w-[20px] h-[20px]"
                      iconSize={20}
                      style={{ marginTop: "-8px", marginRight: "-4px" }}
                    />
                  )}
                </div>
                {dayData.hours > 0 && (
                  <div className="day-hours text-[10px] font-bold tabular-nums text-center">
                    {formatHoursHMM(dayData.hours)}
                  </div>
                )}
                {/* {dayData.expenses > 0 && (
                  <div className="day-expenses text-[9px] font-medium text-green-600 tabular-nums text-center">
                    {formatMoney(dayData.expenses)}
                  </div>
                )} */}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

  const monthName = format(referenceDate, "MMMM yyyy", { locale: nl });
  const weekLabel =
    viewType === "week"
      ? `Week ${format(getWeekBounds(referenceDate).start, "d MMM", {
          locale: nl,
        })} - ${format(getWeekBounds(referenceDate).end, "d MMM yyyy", {
          locale: nl,
        })}`
      : monthName;

  return (
    <>
      <section
        className={`pb-4 border-t border-gray-200 bg-white transition-all duration-300 ${
          isExpanded
            ? "fixed inset-0 w-screen h-screen z-70 overflow-hidden flex flex-col"
            : "w-full mt-auto relative z-55"
        }`}
        onClick={handleComponentClick}
      >
        {/* Close button when expanded */}
        {isExpanded && (
          <button
            onClick={handleCloseExpanded}
            className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Navigation and controls */}
        <div
          className={`flex items-center justify-between pt-4 mb-4 ${
            isExpanded ? "shrink-0" : ""
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handlePrevious}
            className="rounded-full text-gray-600 hover:bg-gray-100 text-5xl sm:text-4xl min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center"
            aria-label={
              viewType === "week" ? "Previous week" : "Previous month"
            }
          >
            ‹
          </button>
          <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-semibold text-gray-900">
              {weekLabel}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToday}
                className="px-2 sm:px-1 sm:py-1 rounded-full border text-xs text-gray-700 hover:bg-gray-100 min-h-[32px] flex items-center justify-center"
                aria-label="Go to today"
              >
                Vandaag
              </button>
              <button
                onClick={handleViewToggle}
                className="px-2 sm:px-1 sm:py-1 rounded-full border text-xs text-gray-700 hover:bg-gray-100 min-h-[32px] flex items-center justify-center"
                aria-label="Toggle view"
              >
                {viewType === "week" ? "Maand" : "Week"}
              </button>
            </div>
          </div>
          <button
            onClick={handleNext}
            className="rounded-full text-gray-600 hover:bg-gray-100 text-5xl sm:text-4xl min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center"
            aria-label={viewType === "week" ? "Next week" : "Next month"}
          >
            ›
          </button>
        </div>

        {/* Calendar grid */}
        <div className={isExpanded ? "shrink-0" : ""}>
          {viewType === "week" ? renderWeekView() : renderMonthView()}
        </div>

        <div className="w-full px-3 py-2 bg-white shadow-[inset_0px_1px_0px_0px_rgba(240,240,240,1.00)] flex justify-between items-center">
          <div className="flex flex-col justify-center items-start gap-0.5">
            <div className="text-gray-900 text-xs font-bold font-sans">
              {viewType === "week" ? "Week" : "Maand"}
            </div>
            <div className="text-gray-900 text-xs font-bold font-sans">
              totaal
            </div>
          </div>
          <div className="flex flex-col justify-center items-start gap-0.5">
            <div className="text-[#808080] text-xs font-bold font-sans">
              Tijd
            </div>
            <div className="text-gray-900 text-xs font-bold font-sans tabular-nums">
              {formatHoursHMM(viewTotals.totalTime)}
            </div>
          </div>
          <div className="flex flex-col justify-center items-start gap-0.5">
            <div className="text-[#808080] text-xs font-bold font-sans">
              Euro&apos;s
            </div>
            <div className="text-teal-500 text-xs font-bold font-sans tabular-nums">
              {formatMoney(viewTotals.totalMoney)}
            </div>
          </div>
          <div className="flex flex-col justify-center items-start gap-0.5">
            <div className="text-[#808080] text-xs font-bold font-sans">
              Uitgaven
            </div>
            <div className="text-red-500 text-xs font-bold font-sans tabular-nums">
              {formatMoney(viewTotals.totalExpenses)}
            </div>
          </div>
        </div>
        {/* Selected date entries list - only show when expanded */}
        {selectedDate && isExpanded && (
          <div
            className="border-t border-gray-200  flex-1 overflow-y-auto min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <DayEntriesListClient
              user={user}
              selectedDate={selectedDate}
              entries={selectedDateEntries}
              expenses={selectedDateExpenses}
              onEntryUpdate={() => {
                // Refetch entries for the current range
                const { start, end } = dateRange;
                const startIso = toIso(start);
                const endIso = toIso(end);
                fetchWeekEntries(user, startIso, endIso);
                fetchWeekExpenses(user, startIso, endIso);
              }}
            />
          </div>
        )}
      </section>
    </>
  );
}
