import { lookupUserByUsername, syncUserWithAuth0 } from "@/lib/supabase/services/projectsService";
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (request) => {
  try {
    const session = await auth0.getSession(request);
    const user = session.user.sub; // This is the auth0 ID (e.g., "auth0|123456789")

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    // Sync user with Auth0 data (updates name if missing)
    const syncedUser = await syncUserWithAuth0(user, session.user);

    // Look up user in Supabase using the auth0 ID as username
    const userData = syncedUser || await lookupUserByUsername(user);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return user data
    return NextResponse.json({
      user: {
        id: userData.id,
        user_name: user,
        display_name: userData.name,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user" },
      { status: 500 }
    );
  }
});


