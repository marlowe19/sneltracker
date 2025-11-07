"use client";

import { useState } from "react";
import { useStore } from "@/stores/useStore";
import DayEntriesModalClient from "./DayEntriesModalClient";

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
    // (start_time should be set to the start of the day when duration_ms is used)
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

export default function DayClickableClient({
  dayDate,
  isToday,
  dayLabel,
  dayNumber,
  hours,
  money,
  expenses,
  user,
  children,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const entries = useStore((state) => state.entries);
  const activeEntries = useStore((state) => state.activeEntries);

  // Merge activeEntries (running timers) with entries (week entries)
  // to ensure running timers are included even if they haven't been fetched yet
  const allEntries = [...entries];

  // Add active entries that aren't already in entries
  activeEntries.forEach((activeEntry) => {
    if (!allEntries.find((e) => e.id === activeEntry.id)) {
      allEntries.push(activeEntry);
    }
  });

  const dayEntries = filterEntriesForDay(allEntries, dayDate);

  const handleDayClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div
        className="day flex flex-col items-center w-full cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition-colors"
        onClick={handleDayClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleDayClick();
          }
        }}
        aria-label={`Edit entries for ${dayLabel}`}
      >
        {children}
      </div>
      <DayEntriesModalClient
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dayDate={dayDate}
        entries={dayEntries}
        user={user}
      />
    </>
  );
}
