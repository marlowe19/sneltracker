import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";
import { UTCDate } from "@date-fns/utc";

/**
 * Date Range utilities for reports and filtering
 * Uses UTC to ensure consistent behavior across timezones
 *
 * NOTE: This is ONLY for date range selection (week/month/quarter).
 * Individual time entries still use local timezone (TIMESTAMPTZ in DB).
 */

/**
 * Parse a date string or Date object to a UTC date representing the calendar day
 * This ensures "November 2024" means the same thing regardless of server timezone
 *
 * @param {string|Date} dateInput - Date to parse
 * @returns {UTCDate} UTC date at noon of the calendar day
 */
function parseToUTCDate(dateInput) {
  if (!dateInput) return new UTCDate();

  let year, month, day;

  if (typeof dateInput === "string") {
    // Extract date components from ISO string (YYYY-MM-DD)
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1; // 0-indexed
      day = parseInt(match[3], 10);
    } else {
      // Fallback: parse as date and extract local components
      const d = new Date(dateInput);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else {
    // Extract local date components from Date object
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  }

  // Create UTC date at noon to avoid DST edge cases
  return new UTCDate(year, month, day, 12, 0, 0);
}

/**
 * Format a date for API transmission (YYYY-MM-DD format)
 * Preserves the calendar date without timezone conversion
 *
 * @param {Date} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatDateForAPI(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get week bounds in UTC (Monday to Sunday)
 *
 * @param {string|Date} dateInput - Reference date
 * @returns {{start: Date, end: Date}} Week start and end dates
 */
export function getWeekBoundsUTC(dateInput) {
  const date = parseToUTCDate(dateInput);
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }), // Monday
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

/**
 * Get month bounds in UTC
 *
 * @param {string|Date} dateInput - Reference date
 * @returns {{start: Date, end: Date}} Month start and end dates
 */
export function getMonthBoundsUTC(dateInput) {
  const date = parseToUTCDate(dateInput);
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

// Format date as YYYY-MM-DD in local timezone (not UTC)
// This ensures the correct day is used regardless of timezone
export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get quarter bounds in UTC
 *
 * @param {string|Date} dateInput - Reference date
 * @returns {{start: Date, end: Date}} Quarter start and end dates
 */
export function getQuarterBoundsUTC(dateInput) {
  const date = parseToUTCDate(dateInput);
  return {
    start: startOfQuarter(date),
    end: endOfQuarter(date),
  };
}

export function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatHoursMinutes(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function getCurrentDate(selectedDate) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
}
