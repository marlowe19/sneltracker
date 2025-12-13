"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getWeekBoundsUTC,
  getMonthBoundsUTC,
  getQuarterBoundsUTC,
  formatDateForAPI,
} from "@/lib/dateRangeUtils";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  addWeeks,
  addMonths,
  addQuarters,
  subWeeks,
  subMonths,
  subQuarters,
  getWeek,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";
import { nl } from "date-fns/locale/nl";

// Format date as DD-MM-YYYY for Dutch locale
function formatDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Parse DD-MM-YYYY format to Date
function parseDateInput(dateString) {
  if (!dateString) return null;
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

// Format date range for display
function formatDateRangeDisplay(start, end) {
  if (!start || !end) return "";
  const startStr = formatDateInput(start);
  const endStr = formatDateInput(end);
  return `${startStr} – ${endStr}`;
}

// Generate calendar month grid with week numbers
function generateMonthGrid(monthDate, startDate, endDate) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = [];
  let currentWeekStart = new Date(calendarStart);

  while (currentWeekStart <= calendarEnd) {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekNumber = getWeek(currentWeekStart, { weekStartsOn: 1 });
    const days = [];

    let currentDay = new Date(currentWeekStart);
    while (currentDay <= weekEnd) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    weeks.push({
      weekNumber,
      days,
    });

    currentWeekStart = addWeeks(currentWeekStart, 1);
  }

  return { weeks, monthStart, monthEnd };
}

// Check if date is in range
function isDateInRange(date, startDate, endDate) {
  if (!startDate || !endDate) return false;
  const dateTime = date.getTime();
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  return dateTime >= startTime && dateTime <= endTime;
}

// Check if date is start or end of range
function isRangeBoundary(date, startDate, endDate) {
  if (!startDate || !endDate) return false;
  return isSameDay(date, startDate) || isSameDay(date, endDate);
}

export default function CustomDateRangeSelectorClient({
  rangeType: initialRangeType = "week",
  referenceDate: initialReferenceDate = new Date(),
  customStartDate: initialCustomStartDate = null,
  customEndDate: initialCustomEndDate = null,
  selectedProjectIds: initialSelectedProjectIds = [],
  billableFilter: initialBillableFilter = "billable",
  includeExpenses: initialIncludeExpenses = true,
  onRangeChange,
}) {
  // Calculate initial bounds
  const getInitialBounds = () => {
    // Use custom dates if provided
    if (initialCustomStartDate && initialCustomEndDate) {
      return {
        start: new Date(initialCustomStartDate),
        end: new Date(initialCustomEndDate),
      };
    }

    if (initialRangeType === "week") {
      return getWeekBoundsUTC(initialReferenceDate);
    } else if (initialRangeType === "month") {
      return getMonthBoundsUTC(initialReferenceDate);
    } else if (initialRangeType === "quarter") {
      return getQuarterBoundsUTC(initialReferenceDate);
    }
    return getWeekBoundsUTC(initialReferenceDate);
  };

  const initialBounds = getInitialBounds();

  const [rangeType, setRangeType] = useState(initialRangeType);
  const [referenceDate, setReferenceDate] = useState(initialReferenceDate);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(initialBounds.start);
  const [tempEndDate, setTempEndDate] = useState(initialBounds.end);
  const [activeField, setActiveField] = useState("start");
  const [displayMonth, setDisplayMonth] = useState(tempStartDate || new Date());

  // Filter state
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [tempSelectedProjectIds, setTempSelectedProjectIds] = useState(
    initialSelectedProjectIds
  );
  const [tempBillableFilter, setTempBillableFilter] = useState(
    initialBillableFilter
  );
  const [tempIncludeExpenses, setTempIncludeExpenses] = useState(
    initialIncludeExpenses
  );
  const [showFilters, setShowFilters] = useState(true); // Always show filters by default
  const [showCalendar, setShowCalendar] = useState(false); // Hide calendar by default

  // Sync with prop changes
  useEffect(() => {
    let bounds;
    if (initialCustomStartDate && initialCustomEndDate) {
      bounds = {
        start: new Date(initialCustomStartDate),
        end: new Date(initialCustomEndDate),
      };
    } else if (initialRangeType === "week") {
      bounds = getWeekBoundsUTC(initialReferenceDate);
    } else if (initialRangeType === "month") {
      bounds = getMonthBoundsUTC(initialReferenceDate);
    } else if (initialRangeType === "quarter") {
      bounds = getQuarterBoundsUTC(initialReferenceDate);
    } else {
      bounds = getWeekBoundsUTC(initialReferenceDate);
    }

    setRangeType(initialRangeType);
    setReferenceDate(initialReferenceDate);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
  }, [
    initialRangeType,
    initialReferenceDate,
    initialCustomStartDate,
    initialCustomEndDate,
  ]);

  // Calculate current range bounds for display
  const currentBounds = useMemo(() => {
    // Check if we have custom dates from props (updated via context)
    if (initialCustomStartDate && initialCustomEndDate) {
      return {
        start: new Date(initialCustomStartDate),
        end: new Date(initialCustomEndDate),
      };
    }

    if (initialRangeType === "week") {
      return getWeekBoundsUTC(initialReferenceDate);
    } else if (initialRangeType === "month") {
      return getMonthBoundsUTC(initialReferenceDate);
    } else if (initialRangeType === "quarter") {
      return getQuarterBoundsUTC(initialReferenceDate);
    }
    return getWeekBoundsUTC(initialReferenceDate);
  }, [
    initialRangeType,
    initialReferenceDate,
    initialCustomStartDate,
    initialCustomEndDate,
  ]);
  const currentRangeLabel = formatDateRangeDisplay(
    currentBounds.start,
    currentBounds.end
  );

  // Generate calendar grid
  const { weeks, monthStart } = generateMonthGrid(
    displayMonth,
    tempStartDate,
    tempEndDate
  );

  const today = new Date();

  const handleOpenModal = async () => {
    const bounds = currentBounds;
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(bounds.start || new Date());
    setActiveField("start");
    setShowCalendar(false); // Don't show calendar by default

    // Reset temp filters to current values
    setTempSelectedProjectIds(initialSelectedProjectIds);
    setTempBillableFilter(initialBillableFilter);
    setTempIncludeExpenses(initialIncludeExpenses);

    // Fetch projects if not already loaded
    if (projects.length === 0) {
      setLoadingProjects(true);
      try {
        const res = await fetch("/my/projecten/api");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
          // If no projects selected, select all by default
          if (initialSelectedProjectIds.length === 0 && data.projects) {
            setTempSelectedProjectIds(data.projects.map((p) => p.id));
          }
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoadingProjects(false);
      }
    } else if (initialSelectedProjectIds.length === 0) {
      // If no projects selected, select all by default
      setTempSelectedProjectIds(projects.map((p) => p.id));
    }

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    const bounds = currentBounds;
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    // Reset temp filters to current values
    setTempSelectedProjectIds(initialSelectedProjectIds);
    setTempBillableFilter(initialBillableFilter);
    setTempIncludeExpenses(initialIncludeExpenses);
    setShowCalendar(false);
  };

  const handleDateClick = (date) => {
    if (activeField === "start") {
      setTempStartDate(date);
      setTempEndDate(null);
      setActiveField("end");
      // Keep calendar open to select end date
    } else if (activeField === "end") {
      if (tempStartDate && date < tempStartDate) {
        // If clicked date is before start, make it the new start
        setTempStartDate(date);
        setTempEndDate(null);
      } else {
        // Set as end date
        setTempEndDate(date);
        // Optionally close calendar after selecting end date
        // setShowCalendar(false);
      }
    }
  };

  const handleStartDateInputFocus = () => {
    setActiveField("start");
    setShowCalendar(true);
    if (tempStartDate) {
      setDisplayMonth(tempStartDate);
    }
  };

  const handleEndDateInputFocus = () => {
    setActiveField("end");
    setShowCalendar(true);
    if (tempEndDate) {
      setDisplayMonth(tempEndDate);
    } else if (tempStartDate) {
      setDisplayMonth(tempStartDate);
    }
  };

  const handleStartDateInputChange = (value) => {
    const date = parseDateInput(value);
    if (date) {
      setTempStartDate(date);
      setDisplayMonth(date);
      if (tempEndDate && date > tempEndDate) {
        setTempEndDate(null);
      }
    }
  };

  const handleEndDateInputChange = (value) => {
    const date = parseDateInput(value);
    if (date) {
      if (tempStartDate && date >= tempStartDate) {
        setTempEndDate(date);
        setDisplayMonth(date);
      }
    }
  };

  const handleClearStart = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    setActiveField("start");
  };

  const handleClearEnd = () => {
    setTempEndDate(null);
    setActiveField("end");
  };

  const handleSet = () => {
    // Allow setting filters even without dates
    const filters = {
      selectedProjectIds: tempSelectedProjectIds,
      billableFilter: tempBillableFilter,
      includeExpenses: tempIncludeExpenses,
    };

    // If dates are selected, determine range type
    if (tempStartDate && tempEndDate) {
      const startWeek = getWeekBoundsUTC(tempStartDate);
      const startMonth = getMonthBoundsUTC(tempStartDate);
      const startQuarter = getQuarterBoundsUTC(tempStartDate);

      let newRangeType = "week";
      let newReferenceDate = tempStartDate;
      let isCustomRange = false;

      if (
        isSameDay(startWeek.start, tempStartDate) &&
        isSameDay(startWeek.end, tempEndDate)
      ) {
        newRangeType = "week";
        newReferenceDate = tempStartDate;
      } else if (
        isSameDay(startMonth.start, tempStartDate) &&
        isSameDay(startMonth.end, tempEndDate)
      ) {
        newRangeType = "month";
        newReferenceDate = tempStartDate;
      } else if (
        isSameDay(startQuarter.start, tempStartDate) &&
        isSameDay(startQuarter.end, tempEndDate)
      ) {
        newRangeType = "quarter";
        newReferenceDate = tempStartDate;
      } else {
        // Custom range - use week as default but pass the actual dates
        newRangeType = "week";
        newReferenceDate = tempStartDate;
        isCustomRange = true;
      }

      setRangeType(newRangeType);
      setReferenceDate(newReferenceDate);

      if (isCustomRange) {
        onRangeChange(
          newRangeType,
          newReferenceDate,
          tempStartDate,
          tempEndDate,
          filters
        );
      } else {
        onRangeChange(newRangeType, newReferenceDate, null, null, filters);
      }
    } else {
      // No dates selected - just apply filters with current range type
      onRangeChange(rangeType, referenceDate, null, null, filters);
    }

    setIsModalOpen(false);
  };

  // Shortcut handlers
  const handleThisWeek = () => {
    const now = new Date();
    const bounds = getWeekBoundsUTC(now);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(now);
    setActiveField("start");
    setShowCalendar(true);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const bounds = getMonthBoundsUTC(now);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(now);
    setActiveField("start");
    setShowCalendar(true);
  };

  const handleThisQuarter = () => {
    const now = new Date();
    const bounds = getQuarterBoundsUTC(now);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(now);
    setActiveField("start");
    setShowCalendar(true);
  };

  const handlePreviousWeek = () => {
    const now = new Date();
    const prevWeek = subWeeks(now, 1);
    const bounds = getWeekBoundsUTC(prevWeek);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(prevWeek);
    setActiveField("start");
    setShowCalendar(true);
  };

  const handlePreviousMonth = () => {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    const bounds = getMonthBoundsUTC(prevMonth);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(prevMonth);
    setActiveField("start");
    setShowCalendar(true);
  };

  const handlePreviousQuarter = () => {
    const now = new Date();
    const prevQuarter = subQuarters(now, 1);
    const bounds = getQuarterBoundsUTC(prevQuarter);
    setTempStartDate(bounds.start);
    setTempEndDate(bounds.end);
    setDisplayMonth(prevQuarter);
    setActiveField("start");
    setShowCalendar(true);
  };

  const handlePreviousMonthNav = () => {
    setDisplayMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonthNav = () => {
    setDisplayMonth((prev) => addMonths(prev, 1));
  };

  // Filter handlers
  const handleProjectToggle = (projectId) => {
    setTempSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleSelectAllProjects = () => {
    setTempSelectedProjectIds(projects.map((p) => p.id));
  };

  const handleDeselectAllProjects = () => {
    setTempSelectedProjectIds([]);
  };

  const allProjectsSelected =
    projects.length > 0 && tempSelectedProjectIds.length === projects.length;
  const someProjectsSelected =
    tempSelectedProjectIds.length > 0 &&
    tempSelectedProjectIds.length < projects.length;

  return (
    <>
      {/* Clickable bar */}
      <div
        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={handleOpenModal}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {currentRangeLabel || "Selecteer datumbereik"}
          </span>
        </div>
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-999"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-t-xl w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <button
                onClick={handleCloseModal}
                className="text-[#008eff] text-sm font-medium"
              >
                Annuleren
              </button>
              <h3 className="text-base font-semibold text-gray-900">
                Datumbereik selecteren
              </h3>
              <button
                onClick={handleSet}
                className="text-[#008eff] text-sm font-medium"
              >
                Instellen
              </button>
            </div>

            {/* Start/End Date Inputs */}
            <div className="flex gap-4 p-4 border-b border-gray-200">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDateInput(tempStartDate)}
                    onChange={(e) => handleStartDateInputChange(e.target.value)}
                    onFocus={handleStartDateInputFocus}
                    onClick={handleStartDateInputFocus}
                    placeholder="DD-MM-JJJJ (klik om kalender te openen)"
                    className={`w-full px-3 py-2 border rounded-lg text-sm cursor-pointer ${
                      activeField === "start"
                        ? "border-[#008eff] bg-gray-50"
                        : "border-gray-300"
                    }`}
                  />
                  {tempStartDate && (
                    <button
                      onClick={handleClearStart}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Einde
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDateInput(tempEndDate)}
                    onChange={(e) => handleEndDateInputChange(e.target.value)}
                    onFocus={handleEndDateInputFocus}
                    onClick={handleEndDateInputFocus}
                    placeholder="DD-MM-JJJJ (klik om kalender te openen)"
                    className={`w-full px-3 py-2 border rounded-lg text-sm cursor-pointer ${
                      activeField === "end"
                        ? "border-[#008eff] bg-gray-50"
                        : "border-gray-300"
                    }`}
                  />
                  {tempEndDate && (
                    <button
                      onClick={handleClearEnd}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Shortcut Buttons */}
            <div className="flex flex-wrap gap-2 p-4 border-b border-gray-200">
              <button
                onClick={handleThisWeek}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Deze week
              </button>
              <button
                onClick={handleThisMonth}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Deze maand
              </button>
              <button
                onClick={handleThisQuarter}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Dit kwartaal
              </button>
              <button
                onClick={handlePreviousWeek}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Vorige week
              </button>
              <button
                onClick={handlePreviousMonth}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Vorige maand
              </button>
              <button
                onClick={handlePreviousQuarter}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Vorige kwartaal
              </button>
            </div>

            {/* Calendar - Conditional */}
            {showCalendar && (
              <div className="flex-1 overflow-y-auto p-4 border-b border-gray-200">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={handlePreviousMonthNav}
                    className="text-[#008eff] p-1"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <h4 className="text-base font-semibold text-[#008eff]">
                    {format(displayMonth, "MMMM yyyy", { locale: nl })}
                  </h4>
                  <button
                    onClick={handleNextMonthNav}
                    className="text-[#008eff] p-1"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="w-full">
                  {/* Day Headers */}
                  <div className="grid grid-cols-8 gap-1 mb-1">
                    <div className="text-xs font-medium text-gray-500 text-center"></div>
                    {["M", "D", "W", "D", "V", "Z", "Z"].map((label, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-medium text-gray-500 text-center"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Weeks */}
                  {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="grid grid-cols-8 gap-1 mb-1">
                      {/* Week Number */}
                      <div className="text-xs text-gray-400 text-center flex items-center justify-center">
                        {week.weekNumber}
                      </div>

                      {/* Days */}
                      {week.days.map((day, dayIdx) => {
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isToday = isSameDay(day, today);
                        const isInRange =
                          tempStartDate &&
                          tempEndDate &&
                          isDateInRange(day, tempStartDate, tempEndDate);
                        const isStart =
                          tempStartDate && isSameDay(day, tempStartDate);
                        const isEnd =
                          tempEndDate && isSameDay(day, tempEndDate);
                        const isBoundary = isRangeBoundary(
                          day,
                          tempStartDate,
                          tempEndDate
                        );

                        return (
                          <button
                            key={dayIdx}
                            onClick={() => handleDateClick(day)}
                            className={`
                            relative h-10 rounded-full w-10 text-sm transition-colors
                            ${
                              !isCurrentMonth
                                ? "text-gray-300"
                                : "text-gray-900"
                            }
                            ${isInRange && !isBoundary ? "bg-blue-100" : ""}
                            ${
                              isStart || isEnd
                                ? "bg-[#008eff] text-white font-semibold"
                                : ""
                            }
                            ${
                              isToday && !isBoundary
                                ? "border-2 border-[#008eff]"
                                : ""
                            }
                            hover:bg-blue-50
                            ${!isCurrentMonth ? "hover:bg-transparent" : ""}
                          `}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters Section - Always Visible */}
            <div className="border-b border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-900">
                  Filters
                </span>
              </div>

              <div className="px-4 pb-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Projects Filter */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Projecten
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAllProjects}
                        className="text-xs text-[#008eff] hover:underline"
                      >
                        Alles selecteren
                      </button>
                      <span className="text-xs text-gray-400">|</span>
                      <button
                        onClick={handleDeselectAllProjects}
                        className="text-xs text-[#008eff] hover:underline"
                      >
                        Alles deselecteren
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {loadingProjects ? (
                      <div className="text-sm text-gray-500 text-center py-2">
                        Laden...
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-2">
                        Geen projecten gevonden
                      </div>
                    ) : (
                      projects.map((project) => {
                        const isSelected = tempSelectedProjectIds.includes(
                          project.id
                        );
                        return (
                          <label
                            key={project.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleProjectToggle(project.id)}
                              className="w-4 h-4 text-[#008eff] border-gray-300 rounded focus:ring-[#008eff]"
                            />
                            <span className="text-sm text-gray-900">
                              {project.name}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {projects.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {tempSelectedProjectIds.length === 0 ||
                      tempSelectedProjectIds.length === projects.length
                        ? "Alle projecten geselecteerd"
                        : `${tempSelectedProjectIds.length} van ${projects.length} geselecteerd`}
                    </div>
                  )}
                </div>

                {/* Billable Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Factureerbaarheid
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTempBillableFilter("billable")}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tempBillableFilter === "billable"
                          ? "bg-[#008eff] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Factureerbaar
                    </button>
                    <button
                      onClick={() => setTempBillableFilter("non-billable")}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tempBillableFilter === "non-billable"
                          ? "bg-[#008eff] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Niet Factureerbaar
                    </button>
                    <button
                      onClick={() => setTempBillableFilter("both")}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tempBillableFilter === "both"
                          ? "bg-[#008eff] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Beide
                    </button>
                  </div>
                </div>

                {/* Expenses Filter */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempIncludeExpenses}
                      onChange={(e) => setTempIncludeExpenses(e.target.checked)}
                      className="w-5 h-5 text-[#008eff] border-gray-300 rounded focus:ring-[#008eff]"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Uitgaven meenemen
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
