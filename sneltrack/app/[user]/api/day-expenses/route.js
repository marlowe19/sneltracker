import { getDayExpenses } from "@/lib/dbFirestore";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { user } = await params;
    const { searchParams } = new URL(request.url);
    const dayDate = searchParams.get("dayDate");

    if (!dayDate) {
      return NextResponse.json(
        { error: "dayDate is required" },
        { status: 400 }
      );
    }

    const expenses = await getDayExpenses(user, new Date(dayDate));
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Error fetching day expenses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch day expenses" },
      { status: 500 }
    );
  }
}

