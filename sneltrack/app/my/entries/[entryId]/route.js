import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import {
  updateEntry,
  deleteEntry,
} from "@/lib/supabase/services/timeEntriesService";

export const dynamic = "force-dynamic";

export const PATCH = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { entryId } = await context.params;

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId is required" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Map 'project' field to 'project_id' if present
    // The client sends 'project' which could be a Supabase UUID or Firestore ID
    // updateEntry expects 'project_id' (Supabase UUID)
    const updates = { ...body };
    if (updates.project !== undefined) {
      // If project is provided, use it as project_id (updateEntry will handle the lookup)
      updates.project_id = updates.project;
      delete updates.project;
    }

    // Update the entry
    const updatedEntry = await updateEntry(user, entryId, updates);

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry", message: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { entryId } = await context.params;

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId is required" },
        { status: 400 }
      );
    }

    await deleteEntry(user, entryId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry", message: error.message },
      { status: 500 }
    );
  }
});
