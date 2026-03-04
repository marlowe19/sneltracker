import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { getUserXP } from "@/lib/supabase/services/xpService";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (request) => {
  try {
    const session = await auth0.getSession(request);
    const user = session.user.sub;

    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "month";
    const date = url.searchParams.get("date") || url.searchParams.get("month");

    const data = await getUserXP(user, period, date || null);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching XP:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch XP" },
      { status: 500 }
    );
  }
});
