import { NextResponse } from "next/server";
import { updateEntry } from "@/lib/dbFirestore";

export async function PATCH(req, context) {
  try {
    const { user, id } = await context.params;
    const body = await req.json();

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    // Build updates object from request body
    const updates = {};
    if (body.start_time !== undefined) {
      updates.start_time = body.start_time;
    }
    if (body.end_time !== undefined) {
      updates.end_time = body.end_time;
    }
    if (body.duration_ms !== undefined) {
      updates.duration_ms = body.duration_ms;
    }
    if (body.hourly_rate !== undefined) {
      updates.hourly_rate = body.hourly_rate;
    }
    if (body.project !== undefined) {
      updates.project = body.project;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await updateEntry(user, id, updates);
    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry", message: error.message },
      { status: 500 }
    );
  }
}
