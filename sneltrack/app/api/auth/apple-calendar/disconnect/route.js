import { NextResponse } from "next/server";
import { removeUserCredentials } from "@/lib/appleCalendar";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    await removeUserCredentials(user);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Apple Calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Apple Calendar", message: error.message },
      { status: 500 }
    );
  }
});


