import { NextResponse } from "next/server";
import { stopEntry } from "@/lib/dbFirestore";
import { computeEntryDurationMs } from "@/lib/time";

async function performStop(user) {
  const entry = await stopEntry(user);
  if (!entry) return null;
  const durationMs = computeEntryDurationMs(entry.start_time, entry.end_time);
  return { entry, durationMs };
}

export async function GET(_req, context) {
  const { user } = await context.params;
  await performStop(user);
  return NextResponse.redirect(
    new URL(`/${encodeURIComponent(user)}`, _req.url),
    302
  );
}

export async function POST(req, context) {
  const { user } = await context.params;
  const result = await performStop(user);
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
