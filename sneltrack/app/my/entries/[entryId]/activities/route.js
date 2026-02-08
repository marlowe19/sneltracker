import { NextResponse } from "next/server";
import { getTimerActivities } from "@/lib/supabase/services/timerActivitiesService";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { entryId } = await context.params;

    const activities = await getTimerActivities(entryId);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching timer activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities", message: error.message },
      { status: 500 }
    );
  }
});



