/**
 * Apple Calendar Service
 * Handles CalDAV credential storage and calendar event queries
 * Uses Supabase users table with user_name field
 */

import { CalDAVClient } from "ts-caldav";
import { supabaseServer } from "./supabaseServer";

/**
 * Store Apple Calendar credentials for a user
 * @param {string} userName - Username (user_name field)
 * @param {string} username - Apple ID email
 * @param {string} password - App-specific password
 */
export async function storeUserCredentials(userName, username, password) {
  if (!userName || !username || !password) {
    throw new Error("userName, username, and password are required");
  }

  // Find user by user_name
  const { data: userData, error: userError } = await supabaseServer
    .from("users")
    .select("id")
    .eq("user_name", userName)
    .single();

  let userId = userData?.id;

  // If user doesn't exist, create one
  if (!userId && userError?.code === "PGRST116") {
    // PGRST116 = no rows returned
    const { data, error } = await supabaseServer
      .from("users")
      .insert({
        user_name: userName,
        apple_calendar_username: username,
        apple_calendar_password: password,
        apple_calendar_connected_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
    return;
  }

  if (!userId) {
    throw new Error(`User not found: ${userName}`);
  }

  // Update existing user
  const { error } = await supabaseServer
    .from("users")
    .update({
      apple_calendar_username: username,
      apple_calendar_password: password,
      apple_calendar_connected_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to store credentials: ${error.message}`);
  }
}

/**
 * Get Apple Calendar credentials for a user
 * @param {string} userName - Username (user_name field)
 * @returns {Object|null} Credentials {username, password} or null if not found
 */
export async function getUserCredentials(userName) {
  if (!userName) {
    return null;
  }

  try {
    const { data, error } = await supabaseServer
      .from("users")
      .select("apple_calendar_username, apple_calendar_password")
      .eq("user_name", userName)
      .single();

    if (
      error ||
      !data?.apple_calendar_username ||
      !data?.apple_calendar_password
    ) {
      return null;
    }

    return {
      username: data.apple_calendar_username,
      password: data.apple_calendar_password,
    };
  } catch (error) {
    console.error("Error getting user credentials:", error);
    return null;
  }
}

/**
 * Remove Apple Calendar credentials for a user (disconnect)
 * @param {string} userName - Username (user_name field)
 */
export async function removeUserCredentials(userName) {
  if (!userName) {
    throw new Error("userName is required");
  }

  // Find user by user_name
  const { data: userData, error: userError } = await supabaseServer
    .from("users")
    .select("id")
    .eq("user_name", userName)
    .single();

  if (userError || !userData?.id) {
    // User doesn't exist, nothing to remove
    return;
  }

  const { error } = await supabaseServer
    .from("users")
    .update({
      apple_calendar_username: null,
      apple_calendar_password: null,
      apple_calendar_connected_at: null,
    })
    .eq("id", userData.id);

  if (error) {
    throw new Error(`Failed to remove credentials: ${error.message}`);
  }
}

/**
 * Get authenticated CalDAV client for a user
 * @param {string} userName - Username
 * @returns {Promise<CalDAVClient|null>} CalDAV client or null if not connected
 */
async function getAuthenticatedClient(userName) {
  if (!userName) {
    console.log("[Apple Calendar] No userName provided");
    return null;
  }

  const credentials = await getUserCredentials(userName);
  if (!credentials) {
    console.log(
      `[Apple Calendar] No credentials found for user: ${userName} (Apple Calendar not connected)`
    );
    return null;
  }

  try {
    console.log(
      `[Apple Calendar] Creating CalDAV client for user: ${userName}`
    );
    const client = await CalDAVClient.create({
      baseUrl: "https://caldav.icloud.com",
      auth: {
        type: "basic",
        username: credentials.username,
        password: credentials.password,
      },
    });

    console.log(
      `[Apple Calendar] CalDAV client created successfully for user: ${userName}`
    );
    return client;
  } catch (error) {
    console.error(
      `[Apple Calendar] Error creating CalDAV client for user ${userName}:`,
      error
    );
    return null;
  }
}

/**
 * Get calendar events for a user's calendar
 * @param {string} userName - Username
 * @param {Date} timeMin - Start time
 * @param {Date} timeMax - End time
 * @returns {Promise<Array>} Array of calendar events with details
 */
export async function getUserCalendarEvents(userName, timeMin, timeMax) {
  if (!userName || !timeMin || !timeMax) {
    console.log(
      `[Apple Calendar] Invalid parameters for getUserCalendarEvents:`,
      { userName, timeMin, timeMax }
    );
    return [];
  }

  console.log(
    `[Apple Calendar] Getting calendar events for user: ${userName}, range: ${timeMin.toISOString()} to ${timeMax.toISOString()}`
  );

  const client = await getAuthenticatedClient(userName);
  if (!client) {
    console.log(
      `[Apple Calendar] No client available for user: ${userName} (not connected or error)`
    );
    return []; // User not connected, return empty
  }

  try {
    // Get available calendars
    console.log(`[Apple Calendar] Fetching calendars for user: ${userName}`);
    const calendars = await client.getCalendars();

    if (!calendars || calendars.length === 0) {
      console.log(`[Apple Calendar] No calendars found for user: ${userName}`);
      return [];
    }

    console.log(
      `[Apple Calendar] Found ${calendars.length} calendars for user: ${userName}`
    );

    // Fetch events from all calendars and combine
    const allEvents = [];

    for (const calendar of calendars) {
      try {
        console.log(
          `[Apple Calendar] Fetching events from calendar: ${calendar.url}`
        );
        // Fetch events - ts-caldav getEvents may or may not support timeRange
        // So we'll fetch all and filter manually
        let events;
        try {
          // Try with timeRange first if supported
          console.log(
            `[Apple Calendar] Attempting to fetch events with timeRange filter`
          );
          events = await client.getEvents(calendar.url, {
            timeRange: {
              start: timeMin,
              end: timeMax,
            },
          });
          console.log(
            `[Apple Calendar] Fetched ${
              events?.length || 0
            } events with timeRange filter`
          );
        } catch (timeRangeError) {
          // If timeRange not supported, fetch all events
          console.log(
            `[Apple Calendar] timeRange not supported, fetching all events:`,
            timeRangeError.message
          );
          events = await client.getEvents(calendar.url);
          console.log(
            `[Apple Calendar] Fetched ${
              events?.length || 0
            } events (all events)`
          );
        }

        // Process events and format similar to Google Calendar format
        for (const event of events) {
          const start = event.start ? new Date(event.start) : null;
          const end = event.end ? new Date(event.end) : null;

          // Filter events that fall within the time range
          if (start && end) {
            if (start <= timeMax && end >= timeMin) {
              allEvents.push({
                id:
                  event.uid ||
                  event.url ||
                  `apple-${Date.now()}-${Math.random()}`,
                title: event.summary || "(No title)",
                start: start.toISOString(),
                end: end.toISOString(),
                description: event.description || null,
                location: event.location || null,
                allDay: event.allDay || false,
                recurring: !!event.rrule,
                attendees: event.attendees || [],
              });
            }
          }
        }
      } catch (calendarError) {
        console.error(
          `Error fetching events from calendar ${calendar.url}:`,
          calendarError
        );
        // Continue with other calendars
      }
    }

    // Sort by start time
    allEvents.sort((a, b) => {
      const aStart = new Date(a.start).getTime();
      const bStart = new Date(b.start).getTime();
      return aStart - bStart;
    });

    console.log(
      `[Apple Calendar] Returning ${allEvents.length} total events for user: ${userName}`
    );
    return allEvents;
  } catch (error) {
    console.error(
      `[Apple Calendar] Error fetching calendar events for user ${userName}:`,
      error
    );
    return []; // Return empty on error (graceful degradation)
  }
}

/**
 * Get free/busy times for a user's calendar
 * Similar to Google Calendar's getUserFreeBusy, converts events to busy time ranges
 * @param {string} userName - Username
 * @param {Date} timeMin - Start time
 * @param {Date} timeMax - End time
 * @returns {Promise<Array<{start: Date, end: Date}>>} Array of busy time ranges
 */
export async function getUserFreeBusy(userName, timeMin, timeMax) {
  if (!userName || !timeMin || !timeMax) {
    console.log(`[Apple Calendar] Invalid parameters for getUserFreeBusy:`, {
      userName,
      timeMin,
      timeMax,
    });
    return [];
  }

  console.log(
    `[Apple Calendar] Getting free/busy times for user: ${userName}, range: ${timeMin.toISOString()} to ${timeMax.toISOString()}`
  );

  // Get calendar events
  const events = await getUserCalendarEvents(userName, timeMin, timeMax);

  if (!events || events.length === 0) {
    console.log(
      `[Apple Calendar] No events found for user: ${userName}, returning empty busy times`
    );
    return [];
  }

  // Filter out all-day events (they don't block specific work hours)
  // and convert to busy time ranges
  const busyTimes = events
    .filter((event) => {
      // Only include timed events (not all-day)
      return !event.allDay && event.start && event.end;
    })
    .map((event) => ({
      start: new Date(event.start),
      end: new Date(event.end),
    }));

  // Sort by start time
  busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping intervals (similar to getAggregatedFreeBusy in googleCalendar.js)
  if (busyTimes.length === 0) {
    return [];
  }

  const merged = [];
  let current = { ...busyTimes[0] };

  for (let i = 1; i < busyTimes.length; i++) {
    const next = busyTimes[i];

    if (next.start <= current.end) {
      // Overlapping, merge
      current.end = new Date(
        Math.max(current.end.getTime(), next.end.getTime())
      );
    } else {
      // Not overlapping, push current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);

  console.log(
    `[Apple Calendar] Returning ${merged.length} busy time ranges for user: ${userName}`
  );
  return merged;
}

/**
 * Get calendar events for a specific day
 * @param {string} userName - Username
 * @param {Date} date - Date to fetch events for
 * @returns {Promise<Array>} Array of calendar events for the day
 */
export async function getUserCalendarEventsForDay(userName, date) {
  if (!userName || !date) {
    console.log(
      `[Apple Calendar] Invalid parameters for getUserCalendarEventsForDay:`,
      { userName, date }
    );
    return [];
  }

  console.log(
    `[Apple Calendar] Getting calendar events for day: ${date.toISOString()} for user: ${userName}`
  );

  // Calculate day start (00:00:00) and day end (23:59:59)
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return getUserCalendarEvents(userName, dayStart, dayEnd);
}

/**
 * Validate Apple Calendar credentials by attempting to connect
 * @param {string} username - Apple ID email
 * @param {string} password - App-specific password
 * @returns {Promise<boolean>} True if credentials are valid
 */
export async function validateCredentials(username, password) {
  if (!username || !password) {
    return false;
  }

  try {
    const client = await CalDAVClient.create({
      baseUrl: "https://caldav.icloud.com",
      auth: {
        type: "basic",
        username: username,
        password: password,
      },
    });

    // Try to get calendars to validate credentials
    await client.getCalendars();
    return true;
  } catch (error) {
    console.error("Error validating credentials:", error);
    return false;
  }
}
