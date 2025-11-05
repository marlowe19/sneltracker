import { NextResponse } from "next/server";
import { stopEntry } from "@/lib/dbFirestore";
import { computeEntryDurationMs } from "@/lib/time";

async function performStop(user, entryId = null) {
  const entry = await stopEntry(user, entryId);
  if (!entry) return null;
  const durationMs = computeEntryDurationMs(
    entry.start_time,
    entry.end_time,
    entry.duration_ms ?? null
  );
  return { entry, durationMs };
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
  const { entry, durationMs } = result;
  return NextResponse.json({
    status: "stopped",
    user,
    startedAt: entry.start_time,
    endedAt: entry.end_time,
    durationMs,
  });
}
