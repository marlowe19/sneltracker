import { NextResponse } from "next/server";
import { startEntry, getActiveEntries } from "@/lib/supabase/services/timeEntriesService";
import { getProjectActivityById } from "@/lib/supabase/services/projectActivitiesService";
import { switchActivity, getCurrentActivity } from "@/lib/supabase/services/timerActivitiesService";
import { lookupUserIdByUsername } from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";

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
        await startEntry(
          user,
          rate ? parseFloat(rate) : null,
          project,
          activityType,
          activityHourlyRate
        );
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
        const entry = await startEntry(
          user,
          rate ? parseFloat(rate) : null,
          project,
          activityType,
          activityHourlyRate
        );
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
