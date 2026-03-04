import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { getLeaderboard } from "@/lib/supabase/services/xpService";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
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
    const period = url.searchParams.get("period") || "month";
    const date = url.searchParams.get("date");

    const data = await getLeaderboard(user, period, date || null);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
