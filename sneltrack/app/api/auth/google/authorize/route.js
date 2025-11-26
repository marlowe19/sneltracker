import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userName = url.searchParams.get("user");

    if (!userName) {
      return NextResponse.json(
        { error: "user parameter is required" },
        { status: 400 }
      );
    }

    const authUrl = getAuthUrl(userName);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate authorization URL", message: error.message },
      { status: 500 }
    );
  }
}


