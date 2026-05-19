import { NextResponse } from "next/server";
import {
  updateProjectActivity,
  deleteProjectActivity,
  assertUserCanManageProjectActivities,
  assertProjectActivityInProject,
  upsertMemberActivityRates,
  getProjectActivityById,
} from "@/lib/supabase/services/projectActivitiesService";
import { getProjectDetail } from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";

export const PATCH = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { projectId, activityId } = await context.params;
    const body = await req.json();

    await assertUserCanManageProjectActivities(user, projectId);
    await assertProjectActivityInProject(activityId, projectId);

    const hasBaseActivityUpdate =
      body.name !== undefined ||
      body.hourly_rate !== undefined ||
      body.icon !== undefined ||
      body.color_hex !== undefined ||
      body.display_order !== undefined;

    let activity;
    if (hasBaseActivityUpdate) {
      activity = await updateProjectActivity(activityId, {
        name: body.name,
        hourly_rate: body.hourly_rate,
        icon: body.icon,
        color_hex: body.color_hex,
        display_order: body.display_order,
      });
    } else {
      activity = await getProjectActivityById(activityId);
    }

    if (
      body.member_activity_rates != null &&
      typeof body.member_activity_rates === "object" &&
      !Array.isArray(body.member_activity_rates)
    ) {
      const detail = await getProjectDetail(user, projectId);
      if (!detail?.is_shared) {
        return NextResponse.json(
          {
            error: "Per-lid activiteitstarief is alleen voor gedeelde projecten",
          },
          { status: 400 }
        );
      }
      await upsertMemberActivityRates(
        activityId,
        projectId,
        body.member_activity_rates
      );
    }

    if (!activity) {
      activity = await getProjectActivityById(activityId);
    }

    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error updating project activity:", error);
    const status = error.statusCode ?? 500;
    return NextResponse.json(
      { error: "Failed to update activity", message: error.message },
      { status }
    );
  }
});

export const DELETE = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { projectId, activityId } = await context.params;

    await assertUserCanManageProjectActivities(user, projectId);
    await assertProjectActivityInProject(activityId, projectId);

    await deleteProjectActivity(activityId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project activity:", error);
    const status = error.statusCode ?? 500;
    return NextResponse.json(
      { error: "Failed to delete activity", message: error.message },
      { status }
    );
  }
});



