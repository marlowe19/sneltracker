import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import {
  saveStoredReport,
  getStoredReports,
  getStoredReport,
  deleteStoredReport,
} from "@/lib/supabase/services/storedReportsService";

export const dynamic = "force-dynamic";

// POST: Save a new report snapshot
export const POST = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    const body = await req.json();
    const { name, description, reportData } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Report name is required" },
        { status: 400 }
      );
    }

    if (!reportData || !reportData.projects || !reportData.totals) {
      return NextResponse.json(
        { error: "Invalid report data. Must include projects and totals" },
        { status: 400 }
      );
    }

    const savedReport = await saveStoredReport(
      user,
      name,
      description,
      reportData
    );

    return NextResponse.json(savedReport);
  } catch (error) {
    console.error("Error saving stored report:", error);
    return NextResponse.json(
      { error: "Failed to save report", message: error.message },
      { status: 500 }
    );
  }
});

// GET: List all stored reports or get a specific one
export const GET = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const url = new URL(req.url);
    const reportId = url.searchParams.get("id");

    if (reportId) {
      // Get specific report
      const report = await getStoredReport(user, reportId);
      return NextResponse.json(report);
    } else {
      // List all reports
      const reports = await getStoredReports(user);
      return NextResponse.json({ reports });
    }
  } catch (error) {
    console.error("Error fetching stored reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports", message: error.message },
      { status: 500 }
    );
  }
});

// DELETE: Delete a stored report
export const DELETE = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const url = new URL(req.url);
    const reportId = url.searchParams.get("id");

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    await deleteStoredReport(user, reportId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stored report:", error);
    return NextResponse.json(
      { error: "Failed to delete report", message: error.message },
      { status: 500 }
    );
  }
});
