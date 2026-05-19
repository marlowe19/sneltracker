import { NextResponse } from "next/server";
import {
  getProjectActivities,
  createProjectActivity,
  assertUserHasProjectAccess,
  assertUserCanManageProjectActivities,
  getMemberActivityRatesBulk,
  effectiveHourlyRateFromBulk,
} from "@/lib/supabase/services/projectActivitiesService";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { projectId } = await context.params;

    const detail = await assertUserHasProjectAccess(user, projectId);
    const activities = await getProjectActivities(projectId);
    const ids = activities.map((a) => a.id);
    const bulk = await getMemberActivityRatesBulk(ids);

    let includeMemberRates = false;
    try {
      await assertUserCanManageProjectActivities(user, projectId);
      includeMemberRates = !!detail.is_shared;
    } catch {
      includeMemberRates = false;
    }

    const enriched = activities.map((a) => {
      const effective_hourly_rate = effectiveHourlyRateFromBulk(a, bulk, user);
      const row = { ...a, effective_hourly_rate };
      if (includeMemberRates) {
        row.member_activity_rates = bulk[a.id] || {};
      }
      return row;
    });

    return NextResponse.json({ activities: enriched });
  } catch (error) {
    console.error("Error fetching project activities:", error);
    const status = error.statusCode ?? 500;
    return NextResponse.json(
      { error: "Failed to fetch activities", message: error.message },
      { status }
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

    await assertUserCanManageProjectActivities(user, projectId);

    const activity = await createProjectActivity(projectId, {
      name: body.name,
      hourly_rate: body.hourly_rate ?? null,
      icon: body.icon || null,
      color_hex: body.color_hex || null,
      display_order: body.display_order ?? 0,
      user_activity_id: body.user_activity_id ?? null,
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error creating project activity:", error);
    const status = error.statusCode ?? 500;
    return NextResponse.json(
      { error: "Failed to create activity", message: error.message },
      { status }
    );
  }
});



