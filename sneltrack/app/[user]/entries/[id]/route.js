import { NextResponse } from "next/server";
import {
  updateEntry,
  deleteEntry,
} from "@/lib/supabase/services/timeEntriesService";

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
    // Handle both project_id (Supabase UUID) and project (could be UUID or Firestore ID)
    if (body.project_id !== undefined) {
      updates.project_id = body.project_id || null;
    } else if (body.project !== undefined) {
      // Client sends 'project' field - could be Supabase UUID or Firestore ID
      // updateEntry will handle the lookup if it's a Firestore ID
      updates.project_id = body.project || null;
    }
    if (body.billable !== undefined) {
      updates.billable = body.billable;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    //const updated = await updateEntry(user, id, updates);
    const updatedInSupabase = await updateEntry(user, id, updates);
    return NextResponse.json({ entry: updatedInSupabase });
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const { user, id } = await context.params;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    await deleteEntry(user, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry", message: error.message },
      { status: 500 }
    );
  }
}
