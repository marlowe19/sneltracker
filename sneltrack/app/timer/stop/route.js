import { NextResponse } from "next/server";
import { stopEntry } from "@/lib/supabase/services/timeEntriesService";
import { computeEntryDurationMs } from "@/lib/time";
import { auth0 } from "@/lib/auth/auth0";

async function performStop(user, entryId = null) {
  const result = await stopEntry(user, entryId);
  if (!result) return null;

  // Handle both single entry and array of entries
  const entries = Array.isArray(result) ? result : [result];

  const results = entries.map((entry) => {
    const durationMs = computeEntryDurationMs(
      entry.start_time,
      entry.end_time,
      entry.duration_ms ?? null
    );
    return { entry, durationMs };
  });

  // Return array if multiple entries, single object if one entry (for backward compatibility)
  return Array.isArray(result) && results.length > 1 ? results : results[0];
}

export const GET = async (req) => {
  try {
    // Try to get session without requiring authentication
    const session = await auth0.getSession(req);
    const user = session?.user?.sub;

    if (user) {
      // User is authenticated - use database timer
      const url = new URL(req.url);
      const entryId = url.searchParams.get("entryId");
      await performStop(user, entryId || null);
      return NextResponse.redirect(new URL(`/my`, req.url), 302);
    } else {
      // User is not authenticated - redirect to root page with action parameter
      const redirectUrl = new URL(`/`, req.url);
      redirectUrl.searchParams.set("action", "stop");
      return NextResponse.redirect(redirectUrl, 302);
    }
  } catch (error) {
    console.error("Error in timer/stop GET:", error);
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
      const body = await req.json().catch(() => ({}));
      const entryId = body.entryId || null;
      const result = await performStop(user, entryId);

      if (!result) {
        return NextResponse.json({
          status: "idle",
          user,
          method: "database",
        });
      }

      // Handle both single entry and array of entries
      const results = Array.isArray(result) ? result : [result];

      if (results.length === 1) {
        // Single entry - return backward compatible format
        const { entry, durationMs } = results[0];
        return NextResponse.json({
          status: "stopped",
          user,
          startedAt: entry.start_time,
          endedAt: entry.end_time,
          durationMs,
          method: "database",
        });
      } else {
        // Multiple entries - return array format
        return NextResponse.json({
          status: "stopped",
          user,
          entries: results.map(({ entry, durationMs }) => ({
            id: entry.id,
            startedAt: entry.start_time,
            endedAt: entry.end_time,
            durationMs,
          })),
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
    console.error("Error in timer/stop:", error);
    return NextResponse.json(
      { error: "Failed to stop timer", message: error.message },
      { status: 500 }
    );
  }
};
