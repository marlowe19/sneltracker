import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  parseISO,
  differenceInMilliseconds,
  addMilliseconds,
} from "date-fns";

export function getWeekBounds(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getMonthBounds(date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end };
}

export function getQuarterBounds(date = new Date()) {
  const start = startOfQuarter(date);
  const end = endOfQuarter(date);
  return { start, end };
}

export function toIso(d) {
  return new Date(d).toISOString();
}

export function roundDurationTo15Minutes(ms) {
  const fifteen = 15 * 60 * 1000;
  return Math.round(ms / fifteen) * fifteen;
}

export function floorTo15Minutes(ms) {
  const fifteen = 15 * 60 * 1000;
  return Math.floor(ms / fifteen) * fifteen;
}

export function computeEntryDurationMs(startIso, endIso, durationMs = null) {
  // If duration_ms is provided, use it directly
  if (durationMs !== null && durationMs !== undefined) {
    return durationMs;
  }
  // Otherwise calculate from start/end times
  const start = parseISO(startIso);
  const end = endIso ? parseISO(endIso) : new Date();
  return Math.max(0, differenceInMilliseconds(end, start));
}

/**
 * Calculate the duration of an entry clipped to date range bounds.
 * Returns only the portion of the entry that falls within the specified range.
 * @param {string} startIso - Entry start time in ISO format
 * @param {string|null} endIso - Entry end time in ISO format (null for active entries)
 * @param {Date} rangeStart - Start of the range
 * @param {Date} rangeEnd - End of the range
 * @param {number|null} durationMs - Optional duration_ms field (takes precedence)
 * @returns {number} Duration in milliseconds
 */
export function computeEntryDurationMsClipped(
  startIso,
  endIso,
  rangeStart,
  rangeEnd,
  durationMs = null
) {
  // If duration_ms is provided, use it directly (assume it's for the day it's assigned to)
  if (durationMs !== null && durationMs !== undefined) {
    // Check if the entry's day falls within the range
    const entryStart = startIso ? parseISO(startIso) : new Date(rangeStart);
    const entryDay = new Date(entryStart);
    entryDay.setHours(0, 0, 0, 0);

    // If entry day is within the range, return full duration_ms
    if (entryDay >= rangeStart && entryDay < rangeEnd) {
      return durationMs;
    }
    return 0;
  }

  // Otherwise calculate from start/end times with clipping
  const entryStart = parseISO(startIso);
  const entryEnd = endIso ? parseISO(endIso) : new Date();

  // Calculate the clipped boundaries
  const clippedStart = entryStart > rangeStart ? entryStart : rangeStart;
  const clippedEnd = entryEnd < rangeEnd ? entryEnd : rangeEnd;

  // Ensure clipped start is before clipped end
  if (clippedStart >= clippedEnd) return 0;

  return Math.max(0, differenceInMilliseconds(clippedEnd, clippedStart));
}

export function formatHMS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function daysBetween(start, end) {
  const days = [];
  const dayMs = 24 * 60 * 60 * 1000;
  let current = new Date(start);
  const endTime = new Date(end).getTime();
  while (current.getTime() <= endTime) {
    days.push(new Date(current));
    current = addMilliseconds(current, dayMs);
  }
  return days;
}
