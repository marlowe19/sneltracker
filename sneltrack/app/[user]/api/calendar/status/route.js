import { NextResponse } from "next/server";
import { getUserTokens, removeUserTokens } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const { user } = await context.params;

    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      );
    }

    const tokens = await getUserTokens(user);
    const isConnected = tokens !== null;

    return NextResponse.json({ isConnected });
  } catch (error) {
    console.error("Error checking calendar status:", error);
    return NextResponse.json(
      { error: "Failed to check calendar status", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const { user } = await context.params;

    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      );
    }

    await removeUserTokens(user);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar", message: error.message },
      { status: 500 }
    );
  }
}



