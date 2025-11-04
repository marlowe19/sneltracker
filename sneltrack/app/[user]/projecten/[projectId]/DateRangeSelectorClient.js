"use client";

import { useState, useEffect } from "react";
import {
  getWeekBounds,
  getMonthBounds,
  getQuarterBounds,
} from "@/lib/time";
import {
  addWeeks,
  addMonths,
  addQuarters,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";

function formatDateRange(start, end, rangeType) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (rangeType === "week") {
    const startStr = startDate.toLocaleDateString("nl-NL", {
      month: "short",
      day: "numeric",
    });
    const endStr = endDate.toLocaleDateString("nl-NL", {
      month: "short",
      day: "numeric",
    });
    const year = startDate.getFullYear();
    return `${startStr} – ${endStr}, ${year}`;
  } else if (rangeType === "month") {
    const monthStr = startDate.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    });
    // Capitalize first letter
    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
  } else if (rangeType === "quarter") {
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    const year = startDate.getFullYear();
    return `Q${quarter} ${year}`;
  }
  return "";
}

function formatRangeListItem(start, end, rangeType) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (rangeType === "week") {
    const startStr = startDate.toLocaleDateString("nl-NL", {
      month: "short",
      day: "numeric",
    });
    const endStr = endDate.toLocaleDateString("nl-NL", {
      month: "short",
      day: "numeric",
    });
    const year = startDate.getFullYear();
    return {
      label: `${startStr} – ${endStr}`,
      year: year.toString(),
      start,
      end,
    };
  } else if (rangeType === "month") {
    const monthStr = startDate.toLocaleDateString("nl-NL", {
      month: "long",
    });
    const year = startDate.getFullYear();
    return {
      label: monthStr.charAt(0).toUpperCase() + monthStr.slice(1),
      year: year.toString(),
      start,
      end,
    };
  } else if (rangeType === "quarter") {
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    const year = startDate.getFullYear();
    return {
      label: `Q${quarter}`,
      year: year.toString(),
      start,
      end,
    };
  }
  return { label: "", year: "", start, end };
}

function generateRanges(rangeType, currentDate, count = 20) {
  const ranges = [];
  const now = new Date();

  if (rangeType === "week") {
    // Generate weeks around current week
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    for (let i = -count / 2; i < count / 2; i++) {
      const weekDate = addWeeks(currentWeekStart, i);
      const { start, end } = getWeekBounds(weekDate);
      ranges.push(formatRangeListItem(start, end, rangeType));
    }
  } else if (rangeType === "month") {
    // Generate months around current month
    const currentMonthStart = startOfMonth(now);
    for (let i = -count / 2; i < count / 2; i++) {
      const monthDate = addMonths(currentMonthStart, i);
      const { start, end } = getMonthBounds(monthDate);
      ranges.push(formatRangeListItem(start, end, rangeType));
    }
  } else if (rangeType === "quarter") {
    // Generate quarters around current quarter
    const currentQuarterStart = startOfQuarter(now);
    for (let i = -count / 2; i < count / 2; i++) {
      const quarterDate = addQuarters(currentQuarterStart, i);
      const { start, end } = getQuarterBounds(quarterDate);
      ranges.push(formatRangeListItem(start, end, rangeType));
    }
  }

  return ranges;
}

export default function DateRangeSelectorClient({
  rangeType: initialRangeType = "week",
  referenceDate: initialReferenceDate = new Date(),
  onRangeChange,
}) {
  const [rangeType, setRangeType] = useState(initialRangeType);
  const [referenceDate, setReferenceDate] = useState(initialReferenceDate);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempRangeType, setTempRangeType] = useState(initialRangeType);
  const [tempReferenceDate, setTempReferenceDate] = useState(
    initialReferenceDate
  );

  // Calculate current range bounds
  const getCurrentBounds = () => {
    if (rangeType === "week") {
      return getWeekBounds(referenceDate);
    } else if (rangeType === "month") {
      return getMonthBounds(referenceDate);
    } else if (rangeType === "quarter") {
      return getQuarterBounds(referenceDate);
    }
    return getWeekBounds(referenceDate);
  };

  const currentBounds = getCurrentBounds();
  const currentRangeLabel = formatDateRange(
    currentBounds.start,
    currentBounds.end,
    rangeType
  );

  // Generate ranges for modal
  const ranges = generateRanges(tempRangeType, tempReferenceDate);

  const handleOpenModal = () => {
    setTempRangeType(rangeType);
    setTempReferenceDate(referenceDate);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTempRangeType(rangeType);
    setTempReferenceDate(referenceDate);
  };

  const handleUpdate = () => {
    // Calculate bounds for the temp reference date and range type
    let tempBounds;
    if (tempRangeType === "week") {
      tempBounds = getWeekBounds(tempReferenceDate);
    } else if (tempRangeType === "month") {
      tempBounds = getMonthBounds(tempReferenceDate);
    } else {
      tempBounds = getQuarterBounds(tempReferenceDate);
    }
    
    setRangeType(tempRangeType);
    setReferenceDate(tempReferenceDate);
    onRangeChange(tempRangeType, tempReferenceDate);
    setIsModalOpen(false);
  };

  const handleRangeSelect = (range) => {
    // Set the reference date to the start of the selected range
    setTempReferenceDate(new Date(range.start));
  };

  return (
    <>
      {/* Clickable bar */}
      <div
        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={handleOpenModal}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {currentRangeLabel}
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
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-t-xl w-full max-w-md max-h-[80vh] flex flex-col"
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
                {formatDateRange(
                  tempRangeType === "week"
                    ? getWeekBounds(tempReferenceDate).start
                    : tempRangeType === "month"
                    ? getMonthBounds(tempReferenceDate).start
                    : getQuarterBounds(tempReferenceDate).start,
                  tempRangeType === "week"
                    ? getWeekBounds(tempReferenceDate).end
                    : tempRangeType === "month"
                    ? getMonthBounds(tempReferenceDate).end
                    : getQuarterBounds(tempReferenceDate).end,
                  tempRangeType
                )}
              </h3>
              <button
                onClick={handleUpdate}
                className="text-[#008eff] text-sm font-medium"
              >
                Bijwerken
              </button>
            </div>

            {/* Segment Controls */}
            <div className="flex gap-2 p-4 border-b border-gray-200">
              {["week", "month", "quarter"].map((type) => {
                const labels = {
                  week: "Week",
                  month: "Maand",
                  quarter: "Kwartaal",
                };
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setTempRangeType(type);
                      // Reset to current date when switching types
                      setTempReferenceDate(new Date());
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tempRangeType === type
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>

            {/* Range List */}
            <div className="flex-1 overflow-y-auto">
              {ranges.map((range, index) => {
                // Check if this range matches the current temp selection
                const tempBounds =
                  tempRangeType === "week"
                    ? getWeekBounds(tempReferenceDate)
                    : tempRangeType === "month"
                    ? getMonthBounds(tempReferenceDate)
                    : getQuarterBounds(tempReferenceDate);
                const isSelected =
                  new Date(range.start).getTime() ===
                    tempBounds.start.getTime() &&
                  new Date(range.end).getTime() === tempBounds.end.getTime();
                return (
                  <button
                    key={index}
                    onClick={() => handleRangeSelect(range)}
                    className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-900">{range.label}</span>
                      <span className="text-sm text-gray-500">{range.year}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

