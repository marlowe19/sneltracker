import { NextResponse } from "next/server";
import {
  getProjectStatistics,
  getProjectStatisticsByMember,
  getProjectById,
  isProjectOwner,
} from "@/lib/dbFirestore";
import { getWeekBounds, getMonthBounds, getQuarterBounds } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const { user, projectId } = await context.params;
    const url = new URL(req.url);
    const rangeType = url.searchParams.get("rangeType");
    const referenceDateParam = url.searchParams.get("referenceDate");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    // Prefer startDate/endDate if provided (avoids timezone recalculation issues)
    // If no date range parameters are provided, dateRange will be null (all-time stats)
    let dateRange = null;
    if (startDateParam && endDateParam) {
      const start = new Date(startDateParam);
      const end = new Date(endDateParam);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate or endDate" },
          { status: 400 }
        );
      }
      dateRange = { start, end };
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
        const { start, end } = getWeekBounds(referenceDate);
        dateRange = { start, end };
      } else if (rangeType === "month") {
        const { start, end } = getMonthBounds(referenceDate);
        dateRange = { start, end };
      } else if (rangeType === "quarter") {
        const { start, end } = getQuarterBounds(referenceDate);
        dateRange = { start, end };
      } else {
        return NextResponse.json(
          { error: "Invalid rangeType. Must be 'week', 'month', or 'quarter'" },
          { status: 400 }
        );
      }
    }
    // If no date range parameters are provided, dateRange remains null for all-time stats

    // Get statistics (all-time if dateRange is null)
    const statistics = await getProjectStatistics(user, projectId, dateRange);

    // Get member statistics if this is a shared project and user is owner
    let memberStatistics = null;
    const project = await getProjectById(user, projectId);
    if (project && project.is_shared) {
      const userIsOwner = await isProjectOwner(user, projectId);
      if (userIsOwner) {
        memberStatistics = await getProjectStatisticsByMember(
          projectId,
          dateRange
        );
      }
    }

    return NextResponse.json({ statistics, memberStatistics });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics", message: error.message },
      { status: 500 }
    );
  }
}
