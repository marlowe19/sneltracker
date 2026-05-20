import { NextResponse } from "next/server";
import { userActivitiesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    const activity = await userActivitiesService.archiveUserActivity(user, id);
    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error archiving activity:", error);
    return NextResponse.json(
      { error: error.message || "Failed to archive activity" },
      { status: 500 }
    );
  }
}
