import { NextResponse } from "next/server";
import { getWeekBounds, getMonthBounds, getQuarterBounds } from "@/lib/time";
import {
  getProjectDetail,
  getProjectVelocity,
} from "@/lib/supabase/services/projectsService";
import { expensesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;
    const { projectId } = await context.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const rangeType = url.searchParams.get("rangeType");
    const referenceDateParam = url.searchParams.get("referenceDate");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    if (action === "expensesSummary") {
      const summary = await expensesService.getProjectExpensesSummary(
        projectId
      );
      return NextResponse.json(summary);
    }

    // Prefer startDate/endDate if provided (avoids timezone recalculation issues)
    // If no date range parameters are provided, startDate/endDate will be null (all-time stats)
    let startDate = null;
    let endDate = null;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate or endDate" },
          { status: 400 }
        );
      }
    } else if (rangeType && referenceDateParam) {
      // Fallback to calculating from reference date
      const referenceDate = new Date(referenceDateParam);
      if (isNaN(referenceDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid referenceDate" },
          { status: 400 }
        );
      }

      // Calculate date bounds based on range type
      if (rangeType === "week") {
        const bounds = getWeekBounds(referenceDate);
        startDate = bounds.start;
        endDate = bounds.end;
      } else if (rangeType === "month") {
        const bounds = getMonthBounds(referenceDate);
        startDate = bounds.start;
        endDate = bounds.end;
      } else if (rangeType === "quarter") {
        const bounds = getQuarterBounds(referenceDate);
        startDate = bounds.start;
        endDate = bounds.end;
      } else {
        return NextResponse.json(
          { error: "Invalid rangeType. Must be 'week', 'month', or 'quarter'" },
          { status: 400 }
        );
      }
    }
    // If no date range parameters are provided, startDate/endDate remain null for all-time stats

    // Get project detail with statistics (migrated to Supabase - single query!)
    const projectDetail = await getProjectDetail(
      user,
      projectId,
      startDate,
      endDate
    );

    if (!projectDetail) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Get velocity metrics
    const velocity = await getProjectVelocity(
      user,
      projectId,
      startDate,
      endDate
    );

    return NextResponse.json({
      statistics: projectDetail.statistics,
      memberStatistics: projectDetail.memberStatistics,
      velocity: velocity,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics", message: error.message },
      { status: 500 }
    );
  }
});
