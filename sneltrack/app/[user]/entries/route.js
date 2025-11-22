import { NextResponse } from "next/server";
import { createEntry } from "@/lib/supabase/services/timeEntriesService";

export async function POST(req, context) {
  try {
    const { user } = await context.params;
    const body = await req.json();

    // Validate required fields
    if (!body.dayDate) {
      return NextResponse.json(
        { error: "dayDate is required" },
        { status: 400 }
      );
    }

    const dayDate = new Date(body.dayDate);
    const durationMs = body.duration_ms ?? null;
    const hourlyRate = body.hourly_rate ?? null;
    const project = body.project_id ?? null;
    const startTime = body.start_time ? new Date(body.start_time) : null;
    const endTime = body.end_time ? new Date(body.end_time) : null;

    const newEntry = await createEntry(
      user,
      dayDate,
      durationMs,
      hourlyRate,
      project,
      startTime,
      endTime
    );
    return NextResponse.json({ entry: newEntry });
  } catch (error) {
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { error: "Failed to create entry", message: error.message },
      { status: 500 }
    );
  }
}
