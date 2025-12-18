import { NextResponse } from "next/server";
import { startEntry } from "@/lib/supabase/services/timeEntriesService";
import { auth0 } from "@/lib/auth/auth0";

export const GET = async (req) => {
  try {
    // Try to get session without requiring authentication
    const session = await auth0.getSession(req);
    const user = session?.user?.sub;

    if (user) {
      // User is authenticated - use database timer
      const url = new URL(req.url);
      const rate = url.searchParams.get("rate");
      const project = url.searchParams.get("project");

      await startEntry(user, rate, project);
      return NextResponse.redirect(new URL(`/my`, req.url), 302);
    } else {
      // User is not authenticated - redirect to root page with action parameter
      const redirectUrl = new URL(`/`, req.url);
      redirectUrl.searchParams.set("action", "start");
      return NextResponse.redirect(redirectUrl, 302);
    }
  } catch (error) {
    console.error("Error in timer/start GET:", error);
    return NextResponse.redirect(new URL(`/`, req.url), 302);
  }
};

export const POST = async (req) => {
  try {
    // Try to get session without requiring authentication
    const session = await auth0.getSession(req);
    const user = session?.user?.sub;

    if (user) {
      // User is authenticated - use database timer
      const url = new URL(req.url);
      const rate = url.searchParams.get("rate");
      const project = url.searchParams.get("project");

      const entry = await startEntry(user, rate, project);
      return NextResponse.json({
        status: "running",
        user,
        startedAt: entry.start_time,
        method: "database",
      });
    } else {
      // User is not authenticated - indicate local timer should be used
      return NextResponse.json({
        status: "local",
        message: "Use local timer (localStorage)",
        method: "local",
      });
    }
  } catch (error) {
    console.error("Error in timer/start:", error);
    return NextResponse.json(
      { error: "Failed to start timer", message: error.message },
      { status: 500 }
    );
  }
};
