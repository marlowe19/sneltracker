import { NextResponse } from "next/server";
import {
  getWeekBoundsUTC,
  getMonthBoundsUTC,
  getQuarterBoundsUTC,
} from "@/lib/dateRangeUtils";
import { getUserProjectReports } from "@/lib/supabase/services/reportsService";

export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const { user } = await context.params;
    const url = new URL(req.url);
    const rangeType = url.searchParams.get("rangeType");
    const referenceDateParam = url.searchParams.get("referenceDate");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    // Calculate date range
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
      const referenceDate = new Date(referenceDateParam);
      if (isNaN(referenceDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid referenceDate" },
          { status: 400 }
        );
      }

      if (rangeType === "week") {
        const { start, end } = getWeekBoundsUTC(referenceDateParam);
        dateRange = { start, end };
      } else if (rangeType === "month") {
        const { start, end } = getMonthBoundsUTC(referenceDateParam);
        dateRange = { start, end };
      } else if (rangeType === "quarter") {
        const { start, end } = getQuarterBoundsUTC(referenceDateParam);
        dateRange = { start, end };
      } else {
        return NextResponse.json(
          { error: "Invalid rangeType. Must be 'week', 'month', or 'quarter'" },
          { status: 400 }
        );
      }
    }

    // ✨ NEW: Use Supabase function instead of N+1 queries
    // Get all project reports in a single efficient SQL query
    const projectsWithStats = await getUserProjectReports(
      user,
      dateRange?.start || new Date(0), // Default to beginning of time if no range
      dateRange?.end || new Date() // Default to now if no range
    );

    // Calculate billable amount for each project (in-memory operation)
    const enrichedProjects = projectsWithStats.map((project) => ({
      ...project,
      billableAmount: project.billableHours * (project.hourlyRate || 0),
    }));

    // Calculate totals (in-memory aggregation)
    const totals = enrichedProjects.reduce(
      (acc, project) => ({
        totalBillableHours: acc.totalBillableHours + project.billableHours,
        totalUnbillableHours:
          acc.totalUnbillableHours + project.unbillableHours,
        totalBillableAmount: acc.totalBillableAmount + project.billableAmount,
      }),
      { totalBillableHours: 0, totalUnbillableHours: 0, totalBillableAmount: 0 }
    );

    return NextResponse.json({
      projects: enrichedProjects,
      totals,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports", message: error.message },
      { status: 500 }
    );
  }
}
