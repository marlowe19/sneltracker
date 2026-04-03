import { NextResponse } from "next/server";
import { userActivitiesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await context.params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    const updates = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.hourly_rate !== undefined) updates.hourly_rate = body.hourly_rate;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.color_hex !== undefined) updates.color_hex = body.color_hex;
    if (body.display_order !== undefined) updates.display_order = body.display_order;
    if (body.archived !== undefined) updates.archived = body.archived;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const activity = await userActivitiesService.updateUserActivity(user, id, updates);
    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update activity" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    await userActivitiesService.deleteUserActivity(user, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete activity" },
      { status: 500 }
    );
  }
}
