import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { getStoredReport } from "@/lib/supabase/services/storedReportsService";
import {
  getTimeEntriesByReportFilters,
} from "@/lib/supabase/services/timeEntriesService";
import {
  getExpensesByReportFilters,
} from "@/lib/supabase/services/expensesService";
import {
  bulkUpdateTimeEntryStatus,
  bulkUpdateExpenseStatus,
} from "@/lib/supabase/services/billingStatusService";

export const dynamic = "force-dynamic";

// GET: Fetch time entries and expenses matching stored report filters
export const GET = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const url = new URL(req.url);
    const reportId = url.searchParams.get("reportId");

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Get the stored report to extract filters
    const report = await getStoredReport(user, reportId);

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const filters = report.report_data?.filters || {};

    // Fetch time entries and expenses matching the filters
    const [timeEntries, expenses] = await Promise.all([
      getTimeEntriesByReportFilters(user, filters),
      getExpensesByReportFilters(user, filters),
    ]);

    return NextResponse.json({
      timeEntries,
      expenses,
    });
  } catch (error) {
    console.error("Error fetching report items:", error);
    return NextResponse.json(
      { error: "Failed to fetch report items", message: error.message },
      { status: 500 }
    );
  }
});

// PATCH: Bulk update status for selected items
export const PATCH = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const body = await req.json();
    const { timeEntryIds, expenseIds, status, reportId } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Verify user owns the report
    if (reportId) {
      const report = await getStoredReport(user, reportId);
      if (!report) {
        return NextResponse.json(
          { error: "Report not found or unauthorized" },
          { status: 404 }
        );
      }
    }

    // Update time entries and expenses in parallel
    const [timeEntryResult, expenseResult] = await Promise.all([
      timeEntryIds && timeEntryIds.length > 0
        ? bulkUpdateTimeEntryStatus(user, timeEntryIds, status)
        : Promise.resolve({ updated: 0 }),
      expenseIds && expenseIds.length > 0
        ? bulkUpdateExpenseStatus(user, expenseIds, status)
        : Promise.resolve({ updated: 0 }),
    ]);

    return NextResponse.json({
      success: true,
      updated: {
        timeEntries: timeEntryResult.updated,
        expenses: expenseResult.updated,
        total: timeEntryResult.updated + expenseResult.updated,
      },
    });
  } catch (error) {
    console.error("Error bulk updating status:", error);
    return NextResponse.json(
      { error: "Failed to update status", message: error.message },
      { status: 500 }
    );
  }
});



