import { NextResponse } from "next/server";
import { stopEntry } from "@/lib/supabase/services/timeEntriesService";
import { computeEntryDurationMs } from "@/lib/time";

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

export async function GET(_req, context) {
  const { user } = await context.params;
  const url = new URL(_req.url);
  const entryId = url.searchParams.get("entryId");
  await performStop(user, entryId || null);
  return NextResponse.redirect(
    new URL(`/${encodeURIComponent(user)}`, _req.url),
    302
  );
}

export async function POST(req, context) {
  const { user } = await context.params;
  const body = await req.json().catch(() => ({}));
  const entryId = body.entryId || null;
  const result = await performStop(user, entryId);
  if (!result) return NextResponse.json({ status: "idle", user });

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
    });
  }
}
