import { NextResponse } from "next/server";
import { getUserTokens, removeUserTokens } from "@/lib/googleCalendar";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    const tokens = await getUserTokens(user);
    const isConnected = tokens !== null;

    return NextResponse.json({ isConnected });
  } catch (error) {
    console.error("Error checking calendar status:", error);
    return NextResponse.json(
      { error: "Failed to check calendar status", message: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    await removeUserTokens(user);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar", message: error.message },
      { status: 500 }
    );
  }
});
