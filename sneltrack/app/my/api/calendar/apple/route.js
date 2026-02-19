import { NextResponse } from "next/server";
import { getUserCalendarEvents, getUserCalendarEventsForDay } from "@/lib/appleCalendar";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");

    let events = [];

    if (dateParam) {
      // Fetch events for a specific date
      const date = new Date(dateParam);
      events = await getUserCalendarEventsForDay(user, date);
    } else {
      // Fetch events for today
      const today = new Date();
      events = await getUserCalendarEventsForDay(user, today);
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching Apple Calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events", message: error.message },
      { status: 500 }
    );
  }
});


