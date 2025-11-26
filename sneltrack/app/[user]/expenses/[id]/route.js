import { NextResponse } from "next/server";
import { updateExpense, deleteExpense } from "@/lib/dbFirestore";

export async function PATCH(req, context) {
  try {
    const { user, id } = await context.params;
    const body = await req.json();

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 }
      );
    }

    // Build updates object from request body
    const updates = {};
    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.price !== undefined) {
      updates.price = body.price;
    }
    if (body.includes_vat !== undefined) {
      updates.includes_vat = body.includes_vat;
    }
    if (body.expense_type !== undefined) {
      updates.expense_type = body.expense_type;
    }
    if (body.project !== undefined) {
      updates.project = body.project;
    }
    if (body.date !== undefined) {
      updates.date = body.date;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await updateExpense(user, id, updates);
    return NextResponse.json({ expense: updated });
  } catch (error) {
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const { user, id } = await context.params;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 }
      );
    }

    await deleteExpense(user, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense", message: error.message },
      { status: 500 }
    );
  }
}






