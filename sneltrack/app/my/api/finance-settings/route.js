import { NextResponse } from "next/server";
import { financeSettingsService } from "@/lib/supabase/services";
import { auth0 } from "@/lib/auth/auth0";

function publicFinanceError(error, fallback) {
  const message = error?.message || "";
  if (!message || /schema cache|PGRST|permission denied|JWT/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function GET(request) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.sub;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const settings = await financeSettingsService.get(user);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching finance settings:", error);
    return NextResponse.json(
      {
        error: publicFinanceError(
          error,
          "Kon financiële instellingen niet ophalen",
        ),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
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
    const settings = await financeSettingsService.upsert(user, body);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating finance settings:", error);
    const status = error.message?.includes("must") ? 400 : 500;
    return NextResponse.json(
      {
        error: publicFinanceError(error, "Kon instellingen niet opslaan"),
      },
      { status },
    );
  }
}
