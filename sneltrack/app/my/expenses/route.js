import { NextResponse } from "next/server";
import { expensesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

export const POST = auth0.withApiAuthRequired(async (req) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;
    const body = await req.json();

    // Validate required fields
    if (!body.dayDate) {
      return NextResponse.json(
        { error: "dayDate is required" },
        { status: 400 }
      );
    }
    if (!body.project) {
      return NextResponse.json(
        { error: "project is required" },
        { status: 400 }
      );
    }
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (body.price === undefined || body.price === null) {
      return NextResponse.json({ error: "price is required" }, { status: 400 });
    }

    const dayDate = new Date(body.dayDate);
    const project = body.project;
    const name = body.name.trim();
    const price = body.price;
    const includesVat = body.includes_vat ?? false;
    const expenseType = body.expense_type ?? "materials";

    const newExpense = await expensesService.create(
      user,
      dayDate,
      project,
      name,
      price,
      includesVat,
      expenseType
    );
    return NextResponse.json({ expense: newExpense });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense", message: error.message },
      { status: 500 }
    );
  }
});

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "weekStart and weekEnd are required" },
        { status: 400 }
      );
    }

    const expenses = await expensesService.getWeekExpenses(
      user,
      weekStart,
      weekEnd
    );
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch expenses" },
      { status: 500 }
    );
  }
});
