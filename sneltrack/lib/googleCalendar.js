/**
 * Google Calendar Service
 * Handles OAuth token storage and free/busy time queries
 * Uses Supabase users table with user_name field
 */

import { google } from "googleapis";
import { supabaseServer } from "./supabaseServer";

const OAuth2Client = google.auth.OAuth2;

/**
 * Get Google Calendar OAuth client
 * @returns {OAuth2Client} OAuth2 client instance
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI"
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Store Google Calendar tokens for a user
 * @param {string} userName - Username (user_name field)
 * @param {Object} tokens - OAuth tokens (access_token, refresh_token, etc.)
 */
export async function storeUserTokens(userName, tokens) {
  if (!userName || !tokens) {
    throw new Error("userName and tokens are required");
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
        google_calendar_tokens: tokens,
        google_calendar_connected_at: new Date().toISOString(),
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
      google_calendar_tokens: tokens,
      google_calendar_connected_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
}

/**
 * Get Google Calendar tokens for a user
 * @param {string} userName - Username (user_name field)
 * @returns {Object|null} OAuth tokens or null if not found
 */
export async function getUserTokens(userName) {
  if (!userName) {
    return null;
  }

  try {
    const { data, error } = await supabaseServer
      .from("users")
      .select("google_calendar_tokens")
      .eq("user_name", userName)
      .single();

    if (error || !data?.google_calendar_tokens) {
      return null;
    }

    return data.google_calendar_tokens;
  } catch (error) {
    console.error("Error getting user tokens:", error);
    return null;
  }
}

/**
 * Remove Google Calendar tokens for a user (disconnect)
 * @param {string} userName - Username (user_name field)
 */
export async function removeUserTokens(userName) {
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
      google_calendar_tokens: null,
      google_calendar_connected_at: null,
    })
    .eq("id", userData.id);

  if (error) {
    throw new Error(`Failed to remove tokens: ${error.message}`);
  }
}

/**
 * Get OAuth2 client with user's tokens
 * @param {string} userName - Username
 * @returns {Promise<OAuth2Client|null>} OAuth2 client or null if not connected
 */
async function getAuthenticatedClient(userName) {
  if (!userName) {
    return null;
  }

  const tokens = await getUserTokens(userName);
  if (!tokens) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Refresh token if expired
  if (oauth2Client.isTokenExpiring()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await storeUserTokens(userName, credentials);
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error("Error refreshing token:", error);
      // Token refresh failed, user needs to reconnect
      await removeUserTokens(userName);
      return null;
    }
  }

  return oauth2Client;
}

/**
 * Get free/busy times for a user's calendar
 * @param {string} userName - Username
 * @param {Date} timeMin - Start time
 * @param {Date} timeMax - End time
 * @returns {Promise<Array<{start: Date, end: Date}>>} Array of busy time ranges
 */
export async function getUserFreeBusy(userName, timeMin, timeMax) {
  if (!userName || !timeMin || !timeMax) {
    return [];
  }

  const oauth2Client = await getAuthenticatedClient(userName);
  if (!oauth2Client) {
    return []; // User not connected, return empty (will use capacity/historical average)
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busyTimes = response.data.calendars?.primary?.busy || [];
    console.log("busyTimes", busyTimes);
    return busyTimes.map((busy) => ({
      start: new Date(busy.start),
      end: new Date(busy.end),
    }));
  } catch (error) {
    console.error("Error fetching free/busy times:", error);
    return []; // Return empty on error (graceful degradation)
  }
}

/**
 * Get aggregated free/busy times for multiple users
 * @param {Array<string>} userNames - Array of usernames
 * @param {Date} timeMin - Start time
 * @param {Date} timeMax - End time
 * @returns {Promise<Array<{start: Date, end: Date}>>} Array of busy time ranges (aggregated)
 */
export async function getAggregatedFreeBusy(userNames, timeMin, timeMax) {
  if (!userNames || !Array.isArray(userNames) || userNames.length === 0) {
    return [];
  }

  if (!timeMin || !timeMax) {
    return [];
  }

  // Fetch free/busy for all users in parallel
  const busyPromises = userNames.map((userName) =>
    getUserFreeBusy(userName, timeMin, timeMax)
  );

  const allBusyTimes = await Promise.all(busyPromises);

  // Flatten and merge overlapping busy times
  const flatBusy = allBusyTimes.flat();

  if (flatBusy.length === 0) {
    return [];
  }

  // Sort by start time
  flatBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping intervals
  const merged = [];
  let current = { ...flatBusy[0] };

  for (let i = 1; i < flatBusy.length; i++) {
    const next = flatBusy[i];

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

  return merged;
}

/**
 * Generate OAuth authorization URL
 * @param {string} userName - Username
 * @returns {string} Authorization URL
 */
export function getAuthUrl(userName) {
  const oauth2Client = getOAuth2Client();
  const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: userName, // Pass username in state for callback
    prompt: "consent", // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} Tokens
 */
export async function exchangeCodeForTokens(code) {
  if (!code) {
    throw new Error("Authorization code is required");
  }

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get actual calendar events for a user's calendar (not just free/busy)
 * @param {string} userName - Username
 * @param {Date} timeMin - Start time
 * @param {Date} timeMax - End time
 * @returns {Promise<Array>} Array of calendar events with details
 */
export async function getUserCalendarEvents(userName, timeMin, timeMax) {
  if (!userName || !timeMin || !timeMax) {
    return [];
  }

  const oauth2Client = await getAuthenticatedClient(userName);
  if (!oauth2Client) {
    return []; // User not connected, return empty
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true, // Expand recurring events
      orderBy: "startTime",
      maxResults: 2500, // Maximum allowed by API
    });

    const events = response.data.items || [];

    return events.map((event) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      const isAllDay = !event.start?.dateTime && !!event.start?.date;
      const isRecurring = !!event.recurringEventId;

      return {
        id: event.id,
        title: event.summary || "(No title)",
        start: start ? new Date(start).toISOString() : null,
        end: end ? new Date(end).toISOString() : null,
        description: event.description || null,
        location: event.location || null,
        allDay: isAllDay,
        recurring: isRecurring,
        attendees: event.attendees?.map((a) => a.email) || [],
      };
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return []; // Return empty on error (graceful degradation)
  }
}
