import { NextResponse } from "next/server";
import { fixedExpensesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (request) => {
  try {
    const session = await auth0.getSession(request);
    const user = session.user.sub;

    const expenses = await fixedExpensesService.getAll(user);
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Error fetching fixed expenses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch fixed expenses" },
      { status: 500 }
    );
  }
});

export const POST = auth0.withApiAuthRequired(async (request) => {
  try {
    const session = await auth0.getSession(request);
    const user = session.user.sub;
    const body = await request.json();

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    if (body.price === undefined || body.price === null || body.price === "") {
      return NextResponse.json(
        { error: "price is required" },
        { status: 400 }
      );
    }
    if (!body.period) {
      return NextResponse.json(
        { error: "period is required" },
        { status: 400 }
      );
    }

    const price = parseFloat(body.price);
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: "price must be a valid non-negative number" },
        { status: 400 }
      );
    }

    const validPeriods = ["month", "quarter", "year"];
    if (!validPeriods.includes(body.period)) {
      return NextResponse.json(
        { error: "period must be month, quarter, or year" },
        { status: 400 }
      );
    }

    const expense = await fixedExpensesService.create(
      user,
      body.name.trim(),
      price,
      body.period
    );
    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Error creating fixed expense:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create fixed expense" },
      { status: 500 }
    );
  }
});
