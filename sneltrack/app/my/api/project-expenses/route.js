import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { expensesService } from "@/lib/supabase/services";
import { getMonthBoundsUTC } from "@/lib/dateRangeUtils";
import { sumOwnProjectExpenses } from "@/lib/finance/projectExpenseTotals";

export async function GET(request) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const rangeType = url.searchParams.get("rangeType");
    const referenceDateParam = url.searchParams.get("referenceDate");

    if (rangeType !== "month" || !referenceDateParam) {
      return NextResponse.json(
        { error: "rangeType=month and referenceDate are required" },
        { status: 400 },
      );
    }

    const referenceDate = new Date(referenceDateParam);
    if (Number.isNaN(referenceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid referenceDate" },
        { status: 400 },
      );
    }

    const { start, end } = getMonthBoundsUTC(referenceDateParam);
    const fromDateStr = start.toISOString().slice(0, 10);
    const toDateStr = end.toISOString().slice(0, 10);

    const expenses = await expensesService.getExpensesBetweenDates(
      user,
      fromDateStr,
      toDateStr,
    );

    const totalCountable = sumOwnProjectExpenses(expenses, user);

    return NextResponse.json({
      expenses,
      totalCountable,
      fromDate: fromDateStr,
      toDate: toDateStr,
    });
  } catch (error) {
    console.error("Error fetching project expenses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch project expenses" },
      { status: 500 },
    );
  }
}
