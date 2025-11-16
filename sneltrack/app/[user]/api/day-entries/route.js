import { getTimeEntries } from "@/lib/dbFirestore";
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

    // Parse YYYY-MM-DD format and create date at start of day in local timezone
    const [year, month, day] = dayDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    const entries = await getTimeEntries(user, date);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching day entries:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch day entries" },
      { status: 500 }
    );
  }
}

