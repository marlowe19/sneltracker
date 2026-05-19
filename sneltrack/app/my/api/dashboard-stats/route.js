import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { computeDashboardStats } from "@/lib/supabase/services/dashboardStatsService";

function isIsoLike(s) {
  return typeof s === "string" && s.length >= 10 && !Number.isNaN(Date.parse(s));
}

export async function POST(request) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { weeks, month } = body || {};

    if (!Array.isArray(weeks) || weeks.length !== 3) {
      return NextResponse.json(
        { error: "Body must include weeks: [3 ranges { start, end }]" },
        { status: 400 },
      );
    }

    for (const w of weeks) {
      if (!isIsoLike(w?.start) || !isIsoLike(w?.end)) {
        return NextResponse.json(
          { error: "Each week needs valid start and end ISO strings" },
          { status: 400 },
        );
      }
    }

    if (
      !month?.expenseFrom ||
      !month?.expenseTo ||
      !isIsoLike(month.clipStartIso) ||
      !isIsoLike(month.clipEndIso) ||
      !Array.isArray(month.entryWeekRanges)
    ) {
      return NextResponse.json(
        { error: "Invalid month payload" },
        { status: 400 },
      );
    }

    for (const w of month.entryWeekRanges) {
      if (!isIsoLike(w?.start) || !isIsoLike(w?.end)) {
        return NextResponse.json(
          { error: "Each entryWeekRange needs valid start and end" },
          { status: 400 },
        );
      }
    }

    const stats = await computeDashboardStats(user, weeks, month);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("dashboard-stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load stats" },
      { status: 500 },
    );
  }
}
