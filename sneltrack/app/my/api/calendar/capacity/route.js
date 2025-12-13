import { NextResponse } from "next/server";
import { getUserFreeBusy } from "@/lib/googleCalendar";
import { isWorkday, getHolidaysInRange } from "@/lib/holidays";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;

    if (!user) {
      return NextResponse.json(
        { error: "user is verplicht" },
        { status: 400 }
      );
    }

    // Calculate next 2 weeks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    // Get free/busy times from Google Calendar
    const busyTimes = await getUserFreeBusy(user, today, twoWeeksLater);

    // Get holidays in range
    const holidays = getHolidaysInRange(today, twoWeeksLater);
    const holidayDates = new Set(
      holidays.map((h) => {
        const d = new Date(h);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );

    // Calculate available hours for each workday, grouped by week
    let week1Hours = 0;
    let week1Workdays = 0;
    let week2Hours = 0;
    let week2Workdays = 0;
    
    const week1End = new Date(today);
    week1End.setDate(week1End.getDate() + 7);
    
    const current = new Date(today);

    while (current <= twoWeeksLater) {
      // Check if it's a workday
      if (!isWorkday(current)) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Check if it's a holiday
      const dateKey = new Date(current);
      dateKey.setHours(0, 0, 0, 0);
      if (holidayDates.has(dateKey.getTime())) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Calculate available hours for this day
      const dayStart = new Date(current);
      dayStart.setHours(9, 0, 0, 0); // Assume 9 AM start
      const dayEnd = new Date(current);
      dayEnd.setHours(17, 0, 0, 0); // Assume 5 PM end

      // Calculate busy time in this day
      let busyMs = 0;
      for (const busy of busyTimes) {
        const busyStart = new Date(Math.max(busy.start.getTime(), dayStart.getTime()));
        const busyEnd = new Date(Math.min(busy.end.getTime(), dayEnd.getTime()));
        
        if (busyStart < busyEnd) {
          busyMs += busyEnd.getTime() - busyStart.getTime();
        }
      }

      // Assume 8-hour workday, subtract busy time
      const workdayMs = 8 * 60 * 60 * 1000; // 8 hours in ms
      const availableMs = Math.max(0, workdayMs - busyMs);
      const availableHours = availableMs / (1000 * 60 * 60);

      // Determine which week this day belongs to
      if (current < week1End) {
        week1Hours += availableHours;
        week1Workdays++;
      } else {
        week2Hours += availableHours;
        week2Workdays++;
      }

      current.setDate(current.getDate() + 1);
    }

    // Calculate average capacity per week (for backward compatibility)
    const averageCapacityPerWeek = (week1Hours + week2Hours) / 2;

    return NextResponse.json({
      capacityPerWeek: Math.round(averageCapacityPerWeek * 10) / 10, // Round to 1 decimal (for backward compatibility)
      week1: {
        hours: Math.round(week1Hours * 10) / 10,
        workdays: week1Workdays,
      },
      week2: {
        hours: Math.round(week2Hours * 10) / 10,
        workdays: week2Workdays,
      },
      totalAvailableHours: week1Hours + week2Hours,
      totalWorkdays: week1Workdays + week2Workdays,
    });
  } catch (error) {
    console.error("Error calculating capacity:", error);
    return NextResponse.json(
      { 
        error: "Capaciteit berekenen mislukt", 
        message: error.message 
      },
      { status: 500 }
    );
  }
});

