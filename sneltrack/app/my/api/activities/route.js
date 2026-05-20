import { NextResponse } from "next/server";
import { userActivitiesService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

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
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const activities = await userActivitiesService.getUserActivities(
      user,
      includeArchived,
    );
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch activities" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const activity = await userActivitiesService.createUserActivity(user, {
      name: body.name.trim(),
      hourly_rate: body.hourly_rate ?? null,
      icon: body.icon ?? null,
      color_hex: body.color_hex ?? null,
      display_order: body.display_order ?? 0,
    });
    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error creating activity:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create activity" },
      { status: 500 },
    );
  }
}
