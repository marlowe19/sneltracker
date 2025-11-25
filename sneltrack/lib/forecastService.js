/**
 * Forecast Service
 * Calculates project completion forecast based on:
 * - Budgeted hours vs hours spent
 * - Member capacity per week (primary) or historical average (fallback)
 * - Google Calendar free/busy times
 * - Netherlands public holidays
 * - Workdays only (Mon-Fri)
 * - Max 60-day lookahead
 * Uses Supabase for all data queries
 */

import { supabaseServer } from "./supabaseServer";
import { getProjectDetail } from "./supabase/services/projectsService";
import { getAggregatedFreeBusy } from "./googleCalendar";
import { isWorkday, getHolidaysInRange } from "./holidays";

const MAX_LOOKAHEAD_DAYS = 60;
const CALENDAR_LOOKAHEAD_DAYS = 30; // For calculating pace from calendar

/**
 * Calculate hours spent on project from time entries
 * @param {Array} entries - Time entries
 * @returns {number} Total hours spent
 */
function calculateHoursSpent(entries) {
  if (!entries || entries.length === 0) return 0;

  let totalMs = 0;
  for (const entry of entries) {
    const durationMs = entry.duration_ms;
    if (durationMs && durationMs > 0) {
      totalMs += durationMs;
    } else if (entry.start_time && entry.end_time) {
      // Calculate from start/end times if duration_ms not available
      const start = new Date(entry.start_time);
      const end = new Date(entry.end_time);
      totalMs += Math.max(0, end.getTime() - start.getTime());
    }
  }

  return totalMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Calculate historical average hours per workday from time entries
 * @param {Array} entries - Time entries
 * @param {Date} startDate - Project start date
 * @returns {number} Average hours per workday
 */
function calculateHistoricalAverage(entries, startDate) {
  if (!entries || entries.length === 0 || !startDate) return 0;

  const totalHours = calculateHoursSpent(entries);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const projectStart = new Date(startDate);
  projectStart.setHours(0, 0, 0, 0);

  if (projectStart >= today) return 0; // Project hasn't started yet

  // Count workdays from project start to today
  let workdays = 0;
  const current = new Date(projectStart);
  const maxDays = 365 * 5; // Safety limit: 5 years max
  let iterations = 0;
  while (current < today && iterations < maxDays) {
    if (isWorkday(current)) {
      workdays++;
    }
    current.setDate(current.getDate() + 1);
    iterations++;
  }

  if (workdays === 0) return 0;
  return totalHours / workdays;
}

/**
 * Calculate total capacity per workday from member capacities
 * @param {Array} members - Project members with capacity_per_week
 * @returns {number} Total hours per workday (aggregated capacity / 5 workdays)
 */
function calculateCapacityPerWorkday(members) {
  if (!members || members.length === 0) return 0;

  let totalCapacityPerWeek = 0;
  for (const member of members) {
    const capacity = member.capacity_per_week;
    if (capacity && capacity > 0) {
      totalCapacityPerWeek += capacity;
    }
  }

  // Convert to hours per workday (assuming 5 workdays per week)
  return totalCapacityPerWeek / 5;
}

/**
 * Check if a time period overlaps with busy times
 * @param {Date} dayStart - Start of day
 * @param {Date} dayEnd - End of day
 * @param {Array} busyTimes - Array of {start, end} busy time ranges
 * @returns {number} Available hours in the day (after subtracting busy times)
 */
function calculateAvailableHours(dayStart, dayEnd, busyTimes) {
  if (!busyTimes || busyTimes.length === 0) {
    // No busy times, assume full workday (8 hours)
    return 8;
  }

  // Calculate total busy time in the day
  let busyMs = 0;
  for (const busy of busyTimes) {
    const busyStart = new Date(
      Math.max(busy.start.getTime(), dayStart.getTime())
    );
    const busyEnd = new Date(Math.min(busy.end.getTime(), dayEnd.getTime()));

    if (busyStart < busyEnd) {
      busyMs += busyEnd.getTime() - busyStart.getTime();
    }
  }

  // Assume 8-hour workday, subtract busy time
  const workdayMs = 8 * 60 * 60 * 1000; // 8 hours in ms
  const availableMs = Math.max(0, workdayMs - busyMs);
  return availableMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Get time entries for a project from Supabase
 * @param {string} projectId - Project UUID
 * @param {string} userName - Username (for filtering if not owner)
 * @param {boolean} isOwner - Whether user is owner
 * @returns {Promise<Array>} Array of time entries
 */
async function getProjectTimeEntries(projectId, userName, isOwner) {
  let query = supabaseServer
    .from("time_entries")
    .select("id, start_time, end_time, duration_ms, user_name")
    .eq("project_id", projectId);

  // If not owner, only get user's entries
  if (!isOwner) {
    query = query.eq("user_name", userName);
  }

  const { data, error } = await query.order("start_time", { ascending: false });

  if (error) {
    console.error("Error fetching project time entries:", error);
    return [];
  }

  return data || [];
}

/**
 * Get project members with capacity from Supabase
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} Array of members with capacity_per_week
 */
async function getProjectMembersWithCapacity(projectId) {
  const { data, error } = await supabaseServer
    .from("project_members")
    .select("user_name, role, capacity_per_week")
    .eq("project_id", projectId);

  if (error) {
    console.error("Error fetching project members:", error);
    return [];
  }

  return data || [];
}

/**
 * Calculate average pace from calendar availability (next 30 days)
 * @param {Array<string>} memberUserNames - Array of member usernames
 * @returns {Promise<number|null>} Average hours per workday, or null if unavailable
 */
async function calculatePaceFromCalendar(memberUserNames) {
  if (!memberUserNames || memberUserNames.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + CALENDAR_LOOKAHEAD_DAYS);

  let busyTimes = [];
  try {
    busyTimes = await getAggregatedFreeBusy(memberUserNames, today, endDate);
  } catch (error) {
    console.error("Error fetching calendar for pace calculation:", error);
    return null;
  }

  const holidays = getHolidaysInRange(today, endDate);
  const holidayDates = new Set(
    holidays.map((h) => {
      const d = new Date(h);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let totalAvailableHours = 0;
  let workdayCount = 0;
  const current = new Date(today);
  let iterations = 0;

  while (current <= endDate && iterations < CALENDAR_LOOKAHEAD_DAYS) {
    if (!isWorkday(current)) {
      current.setDate(current.getDate() + 1);
      iterations++;
      continue;
    }

    const dateKey = new Date(current);
    dateKey.setHours(0, 0, 0, 0);
    if (holidayDates.has(dateKey.getTime())) {
      current.setDate(current.getDate() + 1);
      iterations++;
      continue;
    }

    const dayStart = new Date(current);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(17, 0, 0, 0);

    const availableHours = calculateAvailableHours(dayStart, dayEnd, busyTimes);
    totalAvailableHours += availableHours;
    workdayCount++;

    current.setDate(current.getDate() + 1);
    iterations++;
  }

  if (workdayCount === 0) return null;
  return totalAvailableHours / workdayCount;
}

/**
 * Calculate forecast completion date with given pace
 * @param {number} remainingHours - Hours remaining to complete
 * @param {number} hoursPerWorkday - Hours per workday pace
 * @param {Date} endDate - Project due date
 * @param {Array<string>} memberUserNames - Member usernames for calendar lookup
 * @param {boolean} useCalendar - Whether to use calendar busy times
 * @returns {Object|null} Forecast result or null if exceeds lookahead
 */
async function calculateForecastWithPace(
  remainingHours,
  hoursPerWorkday,
  endDate,
  memberUserNames,
  useCalendar = false
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_LOOKAHEAD_DAYS);

  let busyTimes = [];
  if (useCalendar) {
    try {
      busyTimes = await getAggregatedFreeBusy(memberUserNames, today, maxDate);
    } catch (error) {
      console.error("Error fetching calendar free/busy:", error);
      // Continue without calendar data
    }
  }

  const holidays = getHolidaysInRange(today, maxDate);
  const holidayDates = new Set(
    holidays.map((h) => {
      const d = new Date(h);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let currentDate = new Date(today);
  let hoursRemaining = remainingHours;
  let iterations = 0;

  while (hoursRemaining > 0 && iterations < MAX_LOOKAHEAD_DAYS) {
    if (!isWorkday(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
      iterations++;
      continue;
    }

    const dateKey = new Date(currentDate);
    dateKey.setHours(0, 0, 0, 0);
    if (holidayDates.has(dateKey.getTime())) {
      currentDate.setDate(currentDate.getDate() + 1);
      iterations++;
      continue;
    }

    const dayStart = new Date(currentDate);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(17, 0, 0, 0);

    const availableHours = useCalendar
      ? calculateAvailableHours(dayStart, dayEnd, busyTimes)
      : hoursPerWorkday;
    const hoursToUse = Math.min(availableHours, hoursPerWorkday);

    hoursRemaining -= hoursToUse;

    if (hoursRemaining <= 0) {
      break;
    }

    currentDate.setDate(currentDate.getDate() + 1);
    iterations++;
  }

  if (iterations >= MAX_LOOKAHEAD_DAYS && hoursRemaining > 0) {
    return null; // Forecast exceeds lookahead
  }

  const forecastDate = new Date(currentDate);
  const daysDiff = Math.ceil(
    (forecastDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    forecastDate,
    daysEarly: daysDiff < 0 ? Math.abs(daysDiff) : 0,
    daysLate: daysDiff > 0 ? daysDiff : 0,
    pace: hoursPerWorkday,
  };
}

/**
 * Format forecast explanation text
 * @param {Object} forecast - Forecast result
 * @param {number} pace - Hours per workday
 * @param {string} source - Source description
 * @returns {string} Formatted explanation
 */
function formatForecastExplanation(forecast, pace, source) {
  if (!forecast) return null;
  // Convert from hours per day to hours per week (5 workdays)
  const pacePerWeek = (pace * 5).toFixed(1);
  const dateText = forecast.forecastDate.toLocaleDateString("nl-NL", {
    month: "long",
    day: "numeric",
  });
  return `Gebaseerd op ${source}: met ongeveer ${pacePerWeek} uur per week wordt het project rond ${dateText} voltooid.`;
}

/**
 * Calculate project completion forecast
 * @param {string} userName - Username
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object>} Forecast result with both calendar and historical forecasts
 */
export async function calculateForecast(userName, projectId) {
  // Validate inputs
  if (!userName || !projectId) {
    throw new Error("userName en projectId zijn verplicht");
  }

  // Get project detail (includes members and basic info)
  const projectDetail = await getProjectDetail(userName, projectId);
  if (!projectDetail) {
    throw new Error("Project niet gevonden");
  }

  // Validate required project fields
  if (!projectDetail.budget_hours || projectDetail.budget_hours <= 0) {
    throw new Error("Project moet een budget_hours waarde groter dan 0 hebben");
  }

  if (!projectDetail.start_date) {
    throw new Error("Project moet een start_date hebben");
  }

  if (!projectDetail.due_date) {
    throw new Error("Project moet een due_date hebben");
  }

  const startDate = new Date(projectDetail.start_date);
  const endDate = new Date(projectDetail.due_date);
  const budgetHours = projectDetail.budget_hours;

  // Get time entries for the project
  const entries = await getProjectTimeEntries(
    projectId,
    userName,
    projectDetail.is_owner
  );

  // Get project members with capacity
  const members = await getProjectMembersWithCapacity(projectId);
  const memberUserNames = members.map((m) => m.user_name);

  // Calculate hours spent
  const hoursSpent = calculateHoursSpent(entries);
  const remainingHours = Math.max(0, budgetHours - hoursSpent);

  // If no hours remaining, project is complete
  if (remainingHours <= 0) {
    const today = new Date();
    const daysEarly = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      calendarForecast: null,
      historicalForecast: null,
      explanation: "Project is al voltooid.",
      hoursSpent,
      remainingHours: 0,
    };
  }

  // PRIORITY 1: Calculate pace from calendar (most accurate, 30 days lookahead)
  let calendarPace = null;
  try {
    calendarPace = await calculatePaceFromCalendar(memberUserNames);
  } catch (error) {
    console.error("Error calculating calendar pace:", error);
  }

  // PRIORITY 2: Calculate pace from historical average
  let historicalPace = calculateHistoricalAverage(entries, startDate);

  // PRIORITY 3: Calculate pace from project capacity (separate forecast)
  let capacityPace = null;
  if (projectDetail.capacity_per_week) {
    capacityPace = projectDetail.capacity_per_week / 5; // Convert weekly to daily
  } else if (projectDetail.is_shared && members.length > 0) {
    // For shared projects, use member capacity if project capacity not set
    const memberCapacityPace = calculateCapacityPerWorkday(members);
    if (memberCapacityPace > 0) {
      capacityPace = memberCapacityPace;
    }
  }

  // Fallback: Use capacity as historical fallback if no historical data
  if (!historicalPace && capacityPace) {
    historicalPace = capacityPace;
  }

  // PRIORITY 4: Default fallback (only if no other data available)
  if (!calendarPace && !historicalPace) {
    historicalPace = 4;
  }

  // Calculate all three forecasts
  const calendarForecast = calendarPace
    ? await calculateForecastWithPace(
        remainingHours,
        calendarPace,
        endDate,
        memberUserNames,
        true
      )
    : null;

  const historicalForecast = historicalPace
    ? await calculateForecastWithPace(
        remainingHours,
        historicalPace,
        endDate,
        memberUserNames,
        false
      )
    : null;

  const capacityForecast =
    capacityPace && capacityPace !== historicalPace
      ? await calculateForecastWithPace(
          remainingHours,
          capacityPace,
          endDate,
          memberUserNames,
          false
        )
      : null;

  // Format explanations
  const calendarExplanation = calendarForecast
    ? formatForecastExplanation(
        calendarForecast,
        calendarPace,
        "je agenda voor de komende 30 dagen"
      )
    : null;

  const historicalExplanation = historicalForecast
    ? formatForecastExplanation(
        historicalForecast,
        historicalPace,
        "je historie op dit project"
      )
    : null;

  const capacityExplanation = capacityForecast
    ? formatForecastExplanation(
        capacityForecast,
        capacityPace,
        "je ingestelde capaciteit"
      )
    : null;

  return {
    calendarForecast: calendarForecast
      ? {
          ...calendarForecast,
          explanation: calendarExplanation,
        }
      : null,
    historicalForecast: historicalForecast
      ? {
          ...historicalForecast,
          explanation: historicalExplanation,
        }
      : null,
    capacityForecast: capacityForecast
      ? {
          ...capacityForecast,
          explanation: capacityExplanation,
        }
      : null,
    hoursSpent,
    remainingHours,
  };
}
