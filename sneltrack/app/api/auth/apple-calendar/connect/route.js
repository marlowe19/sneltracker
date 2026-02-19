import { NextResponse } from "next/server";
import { storeUserCredentials, validateCredentials } from "@/lib/appleCalendar";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400 }
      );
    }

    // Validate credentials before storing
    const isValid = await validateCredentials(username, password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your Apple ID and app-specific password." },
        { status: 401 }
      );
    }

    // Store credentials
    await storeUserCredentials(user, username, password);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error connecting Apple Calendar:", error);
    return NextResponse.json(
      { error: "Failed to connect Apple Calendar", message: error.message },
      { status: 500 }
    );
  }
});


