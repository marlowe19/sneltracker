import { NextResponse } from "next/server";
import {
  updateTimerActivity,
  deleteTimerActivity,
} from "@/lib/supabase/services/timerActivitiesService";
import { auth0 } from "@/lib/auth/auth0";

export const PATCH = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { activityId } = await context.params;
    const body = await req.json();

    const activity = await updateTimerActivity(activityId, {
      activity_type: body.activity_type,
      hourly_rate: body.hourly_rate,
      billable: body.billable,
      display_order: body.display_order,
      end_time: body.end_time,
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error updating timer activity:", error);
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

    await deleteTimerActivity(activityId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting timer activity:", error);
    return NextResponse.json(
      { error: "Failed to delete activity", message: error.message },
      { status: 500 }
    );
  }
});


