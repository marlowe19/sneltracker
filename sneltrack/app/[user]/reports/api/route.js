import { NextResponse } from "next/server";
import {
  getAllProjects,
  getProjectStatistics,
  isProjectOwner,
  getProjectTimeEntries,
  getProjectExpenses,
} from "@/lib/dbFirestore";
import { getDb } from "@/lib/firebaseAdmin";
import { getWeekBounds, getMonthBounds, getQuarterBounds } from "@/lib/time";
import { computeEntryDurationMsClipped, computeEntryDurationMs } from "@/lib/time";

export const dynamic = "force-dynamic";

function docToEntry(doc) {
  const data = doc.data();
  const toIso = (ts) => {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (typeof ts === "string") return ts;
    return null;
  };
  return {
    id: doc.id,
    user_name: data.user_name,
    start_time: toIso(data.start_time),
    end_time: toIso(data.end_time),
    duration_ms: data.duration_ms ?? null,
    hourly_rate: data.hourly_rate ?? null,
    project: data.project ?? null,
    created_at: toIso(data.created_at),
    modified_at: toIso(data.modified_at),
    creation_method: data.creation_method ?? null,
    is_running: data.is_running ?? false,
  };
}

async function getProjectEntriesForDateRange(
  userName,
  project,
  dateRange
) {
  let entries = [];

  if (project.is_shared) {
    const isOwner = await isProjectOwner(userName, project.id);
    if (isOwner) {
      entries = await getProjectTimeEntries(project.id);
    } else {
      entries = await getProjectTimeEntries(project.id, userName);
    }
  } else {
    const db = getDb();
    const ref = db.collection("users").doc(userName).collection("time-entries");
    const snap = await ref.where("project", "==", project.id).get();
    entries = snap.docs.map(docToEntry);
  }

  // Filter entries by date range if provided
  if (dateRange && dateRange.start && dateRange.end) {
    const rangeStart =
      dateRange.start instanceof Date
        ? dateRange.start
        : new Date(dateRange.start);
    const rangeEnd =
      dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end);

    entries = entries.filter((entry) => {
      const entryStart = new Date(entry.start_time);
      const entryEnd = entry.end_time ? new Date(entry.end_time) : null;

      return (
        entryStart < rangeEnd && (entryEnd === null || entryEnd >= rangeStart)
      );
    });
  }

  return entries;
}

function calculateBillableBreakdown(entries, dateRange) {
  let billableDurationMs = 0;
  let unbillableDurationMs = 0;

  for (const entry of entries) {
    let durationMs;
    if (dateRange && dateRange.start && dateRange.end) {
      const rangeStart =
        dateRange.start instanceof Date
          ? dateRange.start
          : new Date(dateRange.start);
      const rangeEnd =
        dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end);
      durationMs = computeEntryDurationMsClipped(
        entry.start_time,
        entry.end_time,
        rangeStart,
        rangeEnd,
        entry.duration_ms
      );
    } else {
      durationMs = computeEntryDurationMs(
        entry.start_time,
        entry.end_time,
        entry.duration_ms
      );
    }

    if (durationMs > 0) {
      // Billable if hourly_rate is set (not null and not undefined)
      if (entry.hourly_rate !== null && entry.hourly_rate !== undefined) {
        billableDurationMs += durationMs;
      } else {
        unbillableDurationMs += durationMs;
      }
    }
  }

  const billableHours = billableDurationMs / (1000 * 60 * 60);
  const unbillableHours = unbillableDurationMs / (1000 * 60 * 60);

  return { billableHours, unbillableHours };
}

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

    // Get all projects for the user
    const allProjects = await getAllProjects(user);

    // Calculate statistics for each project
    const projectsWithStats = [];
    let totalBillableHours = 0;
    let totalUnbillableHours = 0;
    let totalBillableAmount = 0;

    for (const project of allProjects) {
      // Get statistics
      const statistics = await getProjectStatistics(user, project.id, dateRange);

      // Only include projects that have entries in the date range
      if (statistics.entryCount === 0) {
        continue;
      }

      // Get entries for billable/unbillable breakdown
      const entries = await getProjectEntriesForDateRange(
        user,
        project,
        dateRange
      );
      const { billableHours, unbillableHours } =
        calculateBillableBreakdown(entries, dateRange);

      // Determine hourly rate for billing
      let hourlyRate = null;
      if (project.is_shared) {
        const isOwner = await isProjectOwner(user, project.id);
        if (isOwner) {
          hourlyRate = project.member_hourly_rate ?? project.hourly_rate;
        } else {
          hourlyRate = project.member_hourly_rate ?? 0;
        }
      } else {
        hourlyRate = project.hourly_rate;
      }

      // Calculate billable amount
      const billableAmount = billableHours * (hourlyRate || 0);

      // Get expenses for this project within date range
      let projectExpenses = [];
      if (project.is_shared) {
        const isOwner = await isProjectOwner(user, project.id);
        if (isOwner) {
          projectExpenses = await getProjectExpenses(project.id);
        } else {
          projectExpenses = await getProjectExpenses(project.id, user);
        }
      } else {
        projectExpenses = await getProjectExpenses(project.id, user);
      }

      // Filter expenses by date range if provided
      let filteredExpenses = projectExpenses;
      if (dateRange && dateRange.start && dateRange.end) {
        const rangeStart =
          dateRange.start instanceof Date
            ? dateRange.start
            : new Date(dateRange.start);
        const rangeEnd =
          dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end);

        filteredExpenses = projectExpenses.filter((expense) => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= rangeStart && expenseDate < rangeEnd;
        });
      }

      // Calculate total expenses
      const totalExpenses = filteredExpenses.reduce((sum, expense) => {
        return sum + (expense.price || 0);
      }, 0);

      // Accumulate totals
      totalBillableHours += billableHours;
      totalUnbillableHours += unbillableHours;
      totalBillableAmount += billableAmount;

      projectsWithStats.push({
        id: project.id,
        name: project.name,
        hourly_rate: project.hourly_rate,
        member_hourly_rate: project.member_hourly_rate ?? null,
        is_shared: project.is_shared ?? false,
        owner: project.owner ?? null,
        is_default: project.is_default ?? false,
        statistics: {
          totalHours: statistics.totalHours,
          totalMoney: statistics.totalMoney,
          entryCount: statistics.entryCount,
        },
        billableHours,
        unbillableHours,
        billableAmount,
        hourlyRate, // The rate to use for billing display
        totalExpenses, // Total expenses for this project
      });
    }

    return NextResponse.json({
      projects: projectsWithStats,
      totals: {
        totalBillableHours,
        totalUnbillableHours,
        totalBillableAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports", message: error.message },
      { status: 500 }
    );
  }
}

