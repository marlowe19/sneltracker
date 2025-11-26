/**
 * Public Holidays Service for Netherlands
 * Uses date-holidays package to get Netherlands public holidays
 */

import Holidays from "date-holidays";

// Cache holidays by year to avoid repeated calculations
const holidaysCache = new Map();

/**
 * Get Netherlands public holidays for a given year
 * @param {number} year - Year to get holidays for
 * @returns {Array<Date>} Array of holiday dates
 */
function getHolidaysForYear(year) {
  if (holidaysCache.has(year)) {
    return holidaysCache.get(year);
  }

  const hd = new Holidays("NL");
  const holidays = hd.getHolidays(year);

  // Convert to Date objects and filter out weekends (holidays package may include them)
  const holidayDates = holidays
    .map((holiday) => {
      const date = new Date(holiday.date);
      // Only include if it's a weekday (Mon-Fri)
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return null; // Skip weekends
      }
      return date;
    })
    .filter((date) => date !== null)
    .map((date) => {
      // Normalize to start of day
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    });

  holidaysCache.set(year, holidayDates);
  return holidayDates;
}

/**
 * Check if a date is a Netherlands public holiday
 * @param {Date} date - Date to check
 * @returns {boolean} True if the date is a public holiday
 */
export function isHoliday(date) {
  if (!date) return false;
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  const year = checkDate.getFullYear();
  const holidays = getHolidaysForYear(year);

  return holidays.some((holiday) => {
    const holidayDate = new Date(holiday);
    holidayDate.setHours(0, 0, 0, 0);
    return holidayDate.getTime() === checkDate.getTime();
  });
}

/**
 * Get all Netherlands public holidays within a date range
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {Array<Date>} Array of holiday dates within the range
 */
export function getHolidaysInRange(startDate, endDate) {
  if (!startDate || !endDate) return [];

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) return [];

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = getHolidaysForYear(year);
    holidays.push(...yearHolidays);
  }

  return holidays.filter((holiday) => {
    const holidayDate = new Date(holiday);
    holidayDate.setHours(0, 0, 0, 0);
    return holidayDate >= start && holidayDate <= end;
  });
}

/**
 * Check if a date is a workday (Monday-Friday and not a holiday)
 * @param {Date} date - Date to check
 * @returns {boolean} True if the date is a workday
 */
export function isWorkday(date) {
  if (!date) return false;
  const checkDate = new Date(date);
  const dayOfWeek = checkDate.getDay();

  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Holiday check
  return !isHoliday(checkDate);
}

