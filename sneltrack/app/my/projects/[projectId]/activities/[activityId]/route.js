import { NextResponse } from "next/server";
import {
  updateProjectActivity,
  deleteProjectActivity,
} from "@/lib/supabase/services/projectActivitiesService";
import { auth0 } from "@/lib/auth/auth0";

export const PATCH = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { activityId } = await context.params;
    const body = await req.json();

    const activity = await updateProjectActivity(activityId, {
      name: body.name,
      hourly_rate: body.hourly_rate,
      icon: body.icon,
      color_hex: body.color_hex,
      display_order: body.display_order,
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error updating project activity:", error);
    return NextResponse.json(
      { error: "Failed to update activity", message: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { activityId } = await context.params;

    await deleteProjectActivity(activityId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project activity:", error);
    return NextResponse.json(
      { error: "Failed to delete activity", message: error.message },
      { status: 500 }
    );
  }
});


