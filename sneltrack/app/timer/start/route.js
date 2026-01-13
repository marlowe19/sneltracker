import { NextResponse } from "next/server";
import {
  startEntry,
  getActiveEntries,
} from "@/lib/supabase/services/timeEntriesService";
import { getProjectActivityById } from "@/lib/supabase/services/projectActivitiesService";
import {
  switchActivity,
  getCurrentActivity,
} from "@/lib/supabase/services/timerActivitiesService";
import {
  lookupUserIdByUsername,
  getUserProjectsWithStats,
} from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";
import { getUserCalendarEvents as getGoogleCalendarEvents } from "@/lib/googleCalendar";
import { getUserCalendarEvents as getAppleCalendarEvents } from "@/lib/appleCalendar";
import { getUserCalendarEventsForDay } from "@/lib/appleCalendar";

/**
 * Find the calendar event closest to the current time
 * @param {string} userName - Username
 * @param {Date} currentTime - Current time to find events around
 * @returns {Promise<Object|null>} Closest event with title, or null if none found
 */
async function findClosestCalendarEvent(userName, currentTime) {
  if (!userName || !currentTime) {
    return null;
  }

  try {
    // Create time window: ±2 hours from current time
    const timeWindowStart = new Date(currentTime);
    timeWindowStart.setHours(timeWindowStart.getHours() - 2);
    const timeWindowEnd = new Date(currentTime);
    timeWindowEnd.setHours(timeWindowEnd.getHours() + 2);

    // Also check if we should extend to end of day
    const dayEnd = new Date(currentTime);
    dayEnd.setHours(23, 59, 59, 999);
    if (timeWindowEnd > dayEnd) {
      timeWindowEnd.setTime(dayEnd.getTime());
    }

    console.log(
      `[Auto-Select Project] Searching for events between ${timeWindowStart.toISOString()} and ${timeWindowEnd.toISOString()}`
    );

    // Fetch events from both calendars
    const [googleEvents, appleEvents] = await Promise.all([
      getGoogleCalendarEvents(userName, timeWindowStart, timeWindowEnd).catch(
        (err) => {
          console.error(
            "[Auto-Select Project] Error fetching Google Calendar events:",
            err
          );
          return [];
        }
      ),
      getAppleCalendarEvents(userName, timeWindowStart, timeWindowEnd).catch(
        (err) => {
          console.error(
            "[Auto-Select Project] Error fetching Apple Calendar events:",
            err
          );
          return [];
        }
      ),
    ]);

    // Combine all events
    const allEvents = [...googleEvents, ...appleEvents];

    if (allEvents.length === 0) {
      console.log("[Auto-Select Project] No events found in time window");
      return null;
    }

    // Filter out all-day events and events without valid start/end times
    const validEvents = allEvents.filter((event) => {
      if (event.allDay) return false;
      if (!event.start || !event.end) return false;
      const start = new Date(event.start);
      const end = new Date(event.end);
      return !isNaN(start.getTime()) && !isNaN(end.getTime());
    });

    if (validEvents.length === 0) {
      console.log(
        "[Auto-Select Project] No valid timed events found (all were all-day or invalid)"
      );
      return null;
    }

    // Find the event closest to current time
    // Priority: events that are currently happening, then upcoming events
    let closestEvent = null;
    let closestDistance = Infinity;

    for (const event of validEvents) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Check if event overlaps with current time
      if (eventStart <= currentTime && currentTime <= eventEnd) {
        // Event is currently happening - highest priority
        closestEvent = event;
        closestDistance = 0;
        break; // Found an active event, use it
      }

      // Check if event is upcoming (starts after current time)
      if (eventStart > currentTime) {
        const distance = eventStart.getTime() - currentTime.getTime();
        if (distance < closestDistance) {
          closestDistance = distance;
          closestEvent = event;
        }
      }
    }

    if (closestEvent) {
      console.log(
        `[Auto-Select Project] Found closest event: "${
          closestEvent.title
        }" at ${new Date(closestEvent.start).toISOString()}`
      );
      return {
        title: closestEvent.title || "(No title)",
        start: closestEvent.start,
        end: closestEvent.end,
      };
    }

    console.log("[Auto-Select Project] No suitable event found");
    return null;
  } catch (error) {
    console.error(
      "[Auto-Select Project] Error finding closest calendar event:",
      error
    );
    return null;
  }
}

/**
 * Find a project by matching its name with a search title
 * @param {string} userName - Username
 * @param {string} searchTitle - Title to search for
 * @returns {Promise<string|null>} Project ID if found, null otherwise
 */
async function findProjectByName(userName, searchTitle) {
  if (!userName || !searchTitle) {
    return null;
  }

  try {
    const projects = await getUserProjectsWithStats(userName);

    if (!projects || projects.length === 0) {
      console.log("[Auto-Select Project] No projects found for user");
      return null;
    }

    // Normalize search title for comparison
    const normalizedSearch = searchTitle.trim().toLowerCase();

    // First, try exact match (case-insensitive)
    let matchedProject = projects.find(
      (project) => project.name.toLowerCase() === normalizedSearch
    );

    if (matchedProject) {
      console.log(
        `[Auto-Select Project] Found exact match: "${matchedProject.name}" (ID: ${matchedProject.id})`
      );
      return matchedProject.id;
    }

    // Then try partial match: project name in search title or vice versa
    matchedProject = projects.find((project) => {
      const projectNameLower = project.name.toLowerCase();
      return (
        projectNameLower.includes(normalizedSearch) ||
        normalizedSearch.includes(projectNameLower)
      );
    });

    if (matchedProject) {
      console.log(
        `[Auto-Select Project] Found partial match: "${matchedProject.name}" (ID: ${matchedProject.id})`
      );
      return matchedProject.id;
    }

    console.log(
      `[Auto-Select Project] No project match found for title: "${searchTitle}"`
    );
    return null;
  } catch (error) {
    console.error(
      "[Auto-Select Project] Error finding project by name:",
      error
    );
    return null;
  }
}

/**
 * Fetch calendar blocks for the current day from both Google and Apple Calendar
 * @param {string} userName - Username
 * @returns {Promise<Object>} Object with google and apple calendar events
 */
async function fetchCalendarBlocksForToday(userName) {
  const today = new Date();
  const calendarBlocks = {
    google: [],
    apple: [],
  };

  console.log("[Calendar Fetch] Starting calendar fetch for user:", userName);

  try {
    // Fetch Google Calendar events
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today);
    dayEnd.setHours(23, 59, 59, 999);

    console.log("[Calendar Fetch] Fetching Google Calendar events...");
    const googleEvents = await getGoogleCalendarEvents(
      userName,
      dayStart,
      dayEnd
    );
    calendarBlocks.google = googleEvents;
    console.log(
      `[Calendar Fetch] Found ${googleEvents.length} Google Calendar events`
    );
  } catch (error) {
    console.error(
      "[Calendar Fetch] Error fetching Google Calendar events:",
      error
    );
    // Continue with Apple Calendar even if Google fails
  }

  try {
    // Fetch Apple Calendar events
    console.log("[Calendar Fetch] Fetching Apple Calendar events...");
    const appleEvents = await getUserCalendarEventsForDay(userName, today);
    calendarBlocks.apple = appleEvents;
    console.log(
      `[Calendar Fetch] Found ${appleEvents.length} Apple Calendar events`
    );
  } catch (error) {
    console.error(
      "[Calendar Fetch] Error fetching Apple Calendar events:",
      error
    );
    // Continue even if Apple Calendar fails
  }

  console.log("[Calendar Fetch] Calendar blocks fetched:", {
    googleCount: calendarBlocks.google.length,
    appleCount: calendarBlocks.apple.length,
  });

  return calendarBlocks;
}

export const GET = async (req) => {
  try {
    // Try to get session without requiring authentication
    const session = await auth0.getSession(req);
    const user = session?.user?.sub;

    if (user) {
      // User is authenticated - use database timer
      const url = new URL(req.url);
      const rate = url.searchParams.get("rate");
      const project = url.searchParams.get("project");
      const activityId = url.searchParams.get("activity_id");

      let activityType = null;
      let activityHourlyRate = null;

      // If activity_id is provided, look up the activity
      if (activityId) {
        try {
          const activity = await getProjectActivityById(activityId);
          if (activity) {
            activityType = activity.name;
            activityHourlyRate = activity.hourly_rate;
          }
        } catch (error) {
          console.error("Error fetching activity by ID:", error);
          // Continue without activity if lookup fails
        }
      }

      // Check if user has a running timer
      const activeEntries = await getActiveEntries(user);
      const runningEntry = activeEntries.length > 0 ? activeEntries[0] : null;

      if (runningEntry && activityType) {
        // User has a running timer and wants to switch activity
        // Check if the activity is different from current
        const currentActivity = await getCurrentActivity(runningEntry.id);
        const currentActivityType = currentActivity?.activity_type;

        if (currentActivityType !== activityType) {
          // Activity is different, switch it
          const userId = await lookupUserIdByUsername(user);
          await switchActivity(
            runningEntry.id,
            activityType,
            activityHourlyRate,
            userId
          );
        }
        // If same activity, do nothing - timer continues with same activity
      } else if (!runningEntry) {
        // No running timer, create a new one
        let selectedProject = project;

        // If no project specified, try to auto-select from calendar
        if (!selectedProject) {
          try {
            const currentTime = new Date();
            const closestEvent = await findClosestCalendarEvent(
              user,
              currentTime
            );

            if (closestEvent && closestEvent.title) {
              const matchedProjectId = await findProjectByName(
                user,
                closestEvent.title
              );

              if (matchedProjectId) {
                selectedProject = matchedProjectId;
                console.log(
                  `[Auto-Select Project] Auto-selected project "${matchedProjectId}" from calendar event "${closestEvent.title}"`
                );
              } else {
                console.log(
                  `[Auto-Select Project] Found event "${closestEvent.title}" but no matching project`
                );
              }
            }
          } catch (error) {
            console.error(
              "[Auto-Select Project] Error during auto-selection:",
              error
            );
            // Continue without project if auto-selection fails
          }
        }

        await startEntry(
          user,
          rate ? parseFloat(rate) : null,
          selectedProject,
          activityType,
          activityHourlyRate
        );

        // Fetch calendar blocks for the current day and log them
        try {
          const calendarBlocks = await fetchCalendarBlocksForToday(user);
          console.log("Calendar blocks for timer start:", calendarBlocks);
        } catch (error) {
          console.error("Error fetching calendar blocks:", error);
          // Don't block timer start if calendar fetch fails
        }
      }
      // If runningEntry exists but no activityType, do nothing (keep existing timer)

      return NextResponse.redirect(new URL(`/my`, req.url), 302);
    } else {
      // User is not authenticated - redirect to root page with action parameter
      const redirectUrl = new URL(`/`, req.url);
      redirectUrl.searchParams.set("action", "start");
      return NextResponse.redirect(redirectUrl, 302);
    }
  } catch (error) {
    console.error("Error in timer/start GET:", error);
    return NextResponse.redirect(new URL(`/`, req.url), 302);
  }
};

export const POST = async (req) => {
  try {
    // Try to get session without requiring authentication
    const session = await auth0.getSession(req);
    const user = session?.user?.sub;

    if (user) {
      // User is authenticated - use database timer
      const url = new URL(req.url);
      const rate = url.searchParams.get("rate");
      const project = url.searchParams.get("project");
      const activityId = url.searchParams.get("activity_id");

      let activityType = null;
      let activityHourlyRate = null;

      // If activity_id is provided, look up the activity
      if (activityId) {
        try {
          const activity = await getProjectActivityById(activityId);
          if (activity) {
            activityType = activity.name;
            activityHourlyRate = activity.hourly_rate;
          }
        } catch (error) {
          console.error("Error fetching activity by ID:", error);
          // Continue without activity if lookup fails
        }
      }

      // Check if user has a running timer
      const activeEntries = await getActiveEntries(user);
      const runningEntry = activeEntries.length > 0 ? activeEntries[0] : null;

      if (runningEntry && activityType) {
        // User has a running timer and wants to switch activity
        // Check if the activity is different from current
        const currentActivity = await getCurrentActivity(runningEntry.id);
        const currentActivityType = currentActivity?.activity_type;

        if (currentActivityType !== activityType) {
          // Activity is different, switch it
          const userId = await lookupUserIdByUsername(user);
          await switchActivity(
            runningEntry.id,
            activityType,
            activityHourlyRate,
            userId
          );
        }
        // If same activity, do nothing - timer continues with same activity

        return NextResponse.json({
          status: "running",
          user,
          startedAt: runningEntry.start_time,
          method: "database",
          activitySwitched: currentActivityType !== activityType,
        });
      } else if (!runningEntry) {
        // No running timer, create a new one
        let selectedProject = project;

        // If no project specified, try to auto-select from calendar
        if (!selectedProject) {
          try {
            const currentTime = new Date();
            const closestEvent = await findClosestCalendarEvent(
              user,
              currentTime
            );

            if (closestEvent && closestEvent.title) {
              const matchedProjectId = await findProjectByName(
                user,
                closestEvent.title
              );

              if (matchedProjectId) {
                selectedProject = matchedProjectId;
                console.log(
                  `[Auto-Select Project] Auto-selected project "${matchedProjectId}" from calendar event "${closestEvent.title}"`
                );
              } else {
                console.log(
                  `[Auto-Select Project] Found event "${closestEvent.title}" but no matching project`
                );
              }
            }
          } catch (error) {
            console.error(
              "[Auto-Select Project] Error during auto-selection:",
              error
            );
            // Continue without project if auto-selection fails
          }
        }

        const entry = await startEntry(
          user,
          rate ? parseFloat(rate) : null,
          selectedProject,
          activityType,
          activityHourlyRate
        );

        // Fetch calendar blocks for the current day and log them
        try {
          console.log(
            "[Timer Start POST] Fetching calendar blocks after starting timer..."
          );
          const calendarBlocks = await fetchCalendarBlocksForToday(user);
          console.log(
            "[Timer Start POST] Calendar blocks for timer start:",
            calendarBlocks
          );
        } catch (error) {
          console.error(
            "[Timer Start POST] Error fetching calendar blocks:",
            error
          );
          // Don't block timer start if calendar fetch fails
        }

        return NextResponse.json({
          status: "running",
          user,
          startedAt: entry.start_time,
          method: "database",
        });
      } else {
        // Running timer exists but no activity specified
        return NextResponse.json({
          status: "running",
          user,
          startedAt: runningEntry.start_time,
          method: "database",
        });
      }
    } else {
      // User is not authenticated - indicate local timer should be used
      return NextResponse.json({
        status: "local",
        message: "Use local timer (localStorage)",
        method: "local",
      });
    }
  } catch (error) {
    console.error("Error in timer/start:", error);
    return NextResponse.json(
      { error: "Failed to start timer", message: error.message },
      { status: 500 }
    );
  }
};
