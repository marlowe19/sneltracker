import { NextResponse } from "next/server";
import { calculateForecast } from "@/lib/forecastService";
import { getProjectDetail } from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";
import { isProjectOwnerLevel } from "@/lib/projectPermissions";

export const dynamic = "force-dynamic";

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const { projectId } = await context.params;

    // Validate inputs
    if (!user || !projectId) {
      return NextResponse.json(
        { error: "user en projectId zijn verplicht" },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const projectDetail = await getProjectDetail(user, projectId);
    if (!projectDetail) {
      return NextResponse.json(
        { error: "Project niet gevonden" },
        { status: 404 }
      );
    }

    // Check access: creator, owner-role member, or any member on shared projects
    if (projectDetail.is_shared) {
      if (
        !isProjectOwnerLevel(projectDetail, user) &&
        !projectDetail.members?.some((m) => m.user_name === user)
      ) {
        return NextResponse.json(
          { error: "Toegang geweigerd" },
          { status: 403 }
        );
      }
    } else {
      if (!projectDetail.is_owner) {
        return NextResponse.json(
          { error: "Toegang geweigerd" },
          { status: 403 }
        );
      }
    }

    // Calculate forecast
    const forecast = await calculateForecast(user, projectId);

    return NextResponse.json(forecast);
  } catch (error) {
    console.error("Error calculating forecast:", error);
    return NextResponse.json(
      {
        error: "Voorspelling berekenen mislukt",
        message: error.message || "Onbekende fout",
      },
      { status: 500 }
    );
  }
});
