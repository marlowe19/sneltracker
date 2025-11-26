import { NextResponse } from "next/server";
import { exchangeCodeForTokens, storeUserTokens } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains userName
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/${encodeURIComponent(state || "")}?error=google_auth_cancelled`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing authorization code or state" },
        { status: 400 }
      );
    }

    const tokens = await exchangeCodeForTokens(code);
    await storeUserTokens(state, tokens);

    // Redirect back to user's page with success message
    return NextResponse.redirect(
      new URL(`/${encodeURIComponent(state)}?google_calendar_connected=true`, req.url)
    );
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    const state = new URL(req.url).searchParams.get("state");
    return NextResponse.redirect(
      new URL(
        `/${encodeURIComponent(state || "")}?error=google_auth_failed`,
        req.url
      )
    );
  }
}


