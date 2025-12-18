import { NextResponse } from "next/server";
import {
  getWeekBoundsUTC,
  getMonthBoundsUTC,
  getQuarterBoundsUTC,
} from "@/lib/dateRangeUtils";
import { getUserProjectReports } from "@/lib/supabase/services/reportsService";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const url = new URL(req.url);
    const rangeType = url.searchParams.get("rangeType");
    const referenceDateParam = url.searchParams.get("referenceDate");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    // Filter parameters
    const projectIdsParam = url.searchParams.get("projectIds");
    const billableFilterParam =
      url.searchParams.get("billableFilter") || "both";
    const includeExpensesParam = url.searchParams.get("includeExpenses");
    const includeExpenses = includeExpensesParam !== "false"; // Default to true

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
    let projectsWithStats = await getUserProjectReports(
      user,
      dateRange?.start || new Date(0), // Default to beginning of time if no range
      dateRange?.end || new Date() // Default to now if no range
    );

    // Apply project filter
    // Empty projectIdsParam or empty array means "all projects"
    if (projectIdsParam) {
      const projectIds = projectIdsParam.split(",").filter(Boolean);
      if (projectIds.length > 0) {
        projectsWithStats = projectsWithStats.filter((project) =>
          projectIds.includes(project.id)
        );
      }
      // If projectIdsParam exists but is empty, show all projects (no filtering)
    }
    // If projectIdsParam is null/undefined, show all projects (no filtering)

    // Apply billable filter
    if (billableFilterParam === "billable") {
      projectsWithStats = projectsWithStats.map((project) => ({
        ...project,
        unbillableHours: 0, // Set to 0 for billable filter
      }));
      // Remove projects with no billable hours
      projectsWithStats = projectsWithStats.filter(
        (project) => project.billableHours > 0
      );
    } else if (billableFilterParam === "non-billable") {
      projectsWithStats = projectsWithStats.map((project) => ({
        ...project,
        billableHours: 0, // Set to 0 for non-billable filter
        billableAmount: 0,
      }));
      // Remove projects with no unbillable hours
      projectsWithStats = projectsWithStats.filter(
        (project) => project.unbillableHours > 0
      );
    }

    // Calculate billable amount for each project (in-memory operation)
    let enrichedProjects = projectsWithStats.map((project) => ({
      ...project,
      billableAmount: project.billableHours * (project.hourlyRate || 0),
    }));

    // Apply expenses filter
    if (!includeExpenses) {
      enrichedProjects = enrichedProjects.map((project) => ({
        ...project,
        totalExpenses: 0,
      }));
    }

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
});
