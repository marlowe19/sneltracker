import { getDayEntries } from "@/lib/supabase/services/timeEntriesService";
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (request) => {
  try {
    const session = await auth0.getSession(request);
    const user = session.user.nickname;
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

    const entries = await getDayEntries(user, date);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching day entries:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch day entries" },
      { status: 500 }
    );
  }
});
