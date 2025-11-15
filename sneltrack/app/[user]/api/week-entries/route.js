import { getWeekEntries } from "@/lib/dbFirestore";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { user } = await params;
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "weekStart and weekEnd are required" },
        { status: 400 }
      );
    }

    const entries = await getWeekEntries(user, weekStart, weekEnd);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching week entries:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch week entries" },
      { status: 500 }
    );
  }
}


