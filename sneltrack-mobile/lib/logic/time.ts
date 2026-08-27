// lib/logic/time.ts
// Ported 1:1 from sneltrack/lib/time.js
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

export interface DateRange {
  start: Date;
  end: Date;
}

export function getWeekBounds(date: Date = new Date()): DateRange {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getMonthBounds(date: Date = new Date()): DateRange {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end };
}

export function getQuarterBounds(date: Date = new Date()): DateRange {
  const start = startOfQuarter(date);
  const end = endOfQuarter(date);
  return { start, end };
}

export function toIso(d: Date | string | number): string {
  return new Date(d).toISOString();
}

export function roundDurationTo15Minutes(ms: number): number {
  const fifteen = 15 * 60 * 1000;
  return Math.round(ms / fifteen) * fifteen;
}

export function floorTo15Minutes(ms: number): number {
  const fifteen = 15 * 60 * 1000;
  return Math.floor(ms / fifteen) * fifteen;
}

export function computeEntryDurationMs(
  startIso: string,
  endIso: string | null | undefined,
  durationMs: number | null = null
): number {
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
 */
export function computeEntryDurationMsClipped(
  startIso: string,
  endIso: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  durationMs: number | null = null
): number {
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

export function formatHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatHM(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function daysBetween(start: Date | string | number, end: Date | string | number): Date[] {
  const days: Date[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  let current = new Date(start);
  const endTime = new Date(end).getTime();
  while (current.getTime() <= endTime) {
    days.push(new Date(current));
    current = addMilliseconds(current, dayMs);
  }
  return days;
}
