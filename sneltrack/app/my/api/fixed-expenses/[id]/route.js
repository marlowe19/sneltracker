import { NextResponse } from "next/server";
import { fixedExpensesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

export async function PATCH(request, context) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await context.params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 }
      );
    }

    const updates = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.price !== undefined) updates.price = body.price;
    if (body.period !== undefined) updates.period = body.period;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const expense = await fixedExpensesService.update(user, id, updates);
    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Error updating fixed expense:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update fixed expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 }
      );
    }

    await fixedExpensesService.remove(user, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fixed expense:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete fixed expense" },
      { status: 500 }
    );
  }
}
