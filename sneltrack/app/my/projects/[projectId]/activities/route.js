import { NextResponse } from "next/server";
import {
  getProjectActivities,
  createProjectActivity,
} from "@/lib/supabase/services/projectActivitiesService";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { projectId } = await context.params;

    const activities = await getProjectActivities(projectId);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching project activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities", message: error.message },
      { status: 500 }
    );
  }
});

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { projectId } = await context.params;
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Activity name is required" },
        { status: 400 }
      );
    }

    const activity = await createProjectActivity(projectId, {
      name: body.name,
      hourly_rate: body.hourly_rate ?? null,
      icon: body.icon || null,
      color_hex: body.color_hex || null,
      display_order: body.display_order ?? 0,
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error creating project activity:", error);
    return NextResponse.json(
      { error: "Failed to create activity", message: error.message },
      { status: 500 }
    );
  }
});



