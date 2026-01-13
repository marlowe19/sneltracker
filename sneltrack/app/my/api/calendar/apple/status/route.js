import { NextResponse } from "next/server";
import { getUserCredentials } from "@/lib/appleCalendar";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    const credentials = await getUserCredentials(user);
    const isConnected = credentials !== null;

    return NextResponse.json({ isConnected });
  } catch (error) {
    console.error("Error checking Apple Calendar status:", error);
    return NextResponse.json(
      { error: "Failed to check calendar status", message: error.message },
      { status: 500 }
    );
  }
});
