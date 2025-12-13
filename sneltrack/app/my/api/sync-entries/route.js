import { NextResponse } from "next/server";
import { createEntry } from "@/lib/supabase/services/timeEntriesService";
import { auth0 } from "@/lib/auth/auth0";

/**
 * POST /my/api/sync-entries
 * Syncs an array of local time entries to Supabase
 * Accepts 1 or many entries - DRY approach
 * 
 * Body: { entries: Array<{ start_time, end_time, duration_ms }> }
 * Returns: { synced: Array<{ localId, supabaseId }>, failed: Array<{ localId, error }> }
 */
export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;
    const body = await req.json();
    
    // Validate entries array
    if (!body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: "entries array is required" },
        { status: 400 }
      );
    }
    
    if (body.entries.length === 0) {
      return NextResponse.json({ synced: [], failed: [] });
    }
    
    const synced = [];
    const failed = [];
    
    // Process each entry
    for (const entry of body.entries) {
      try {
        // Validate required fields
        if (!entry.start_time) {
          failed.push({
            localId: entry.id || "unknown",
            error: "start_time is required",
          });
          continue;
        }
        
        // Skip entries that are still running
        if (entry.is_running) {
          failed.push({
            localId: entry.id || "unknown",
            error: "Cannot sync running entries",
          });
          continue;
        }
        
        const startTime = new Date(entry.start_time);
        const endTime = entry.end_time ? new Date(entry.end_time) : null;
        const durationMs = entry.duration_ms ?? null;
        
        // Use the start_time date as dayDate
        const dayDate = new Date(startTime);
        dayDate.setHours(0, 0, 0, 0);
        
        // Create entry in Supabase (no project, no hourly rate for anonymous entries)
        const newEntry = await createEntry(
          user,
          dayDate,
          durationMs,
          null, // hourlyRate - user can set after login
          null, // project - user can assign after login
          startTime,
          endTime
        );
        
        synced.push({
          localId: entry.id,
          supabaseId: newEntry.id,
        });
      } catch (entryError) {
        console.error(`Error syncing entry ${entry.id}:`, entryError);
        failed.push({
          localId: entry.id || "unknown",
          error: entryError.message,
        });
      }
    }
    
    return NextResponse.json({ synced, failed });
  } catch (error) {
    console.error("Error syncing entries:", error);
    return NextResponse.json(
      { error: "Failed to sync entries", message: error.message },
      { status: 500 }
    );
  }
});

