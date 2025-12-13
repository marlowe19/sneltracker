import { getWeekEntries } from "@/lib/supabase/services/timeEntriesService";
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
export async function GET(request, { params }) {
  try {
    const session = await auth0.getSession(request);
    console.log("session", session);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.nickname;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
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
