import { NextResponse } from "next/server";
import { switchActivity } from "@/lib/supabase/services/timerActivitiesService";
import { lookupUserIdByUsername } from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { entryId } = await context.params;
    const body = await req.json();

    // Validate required fields
    if (!body.activity_type || !body.activity_type.trim()) {
      return NextResponse.json(
        { error: "Activity type is required" },
        { status: 400 }
      );
    }

    // Look up user_id from username
    const userId = await lookupUserIdByUsername(user);

    const activity = await switchActivity(
      entryId,
      body.activity_type,
      body.hourly_rate ?? null,
      userId
    );

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error switching activity:", error);
    return NextResponse.json(
      { error: "Failed to switch activity", message: error.message },
      { status: 500 }
    );
  }
});

