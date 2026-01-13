import { NextResponse } from "next/server";
import { startEntry } from "@/lib/supabase/services/timeEntriesService";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  const session = await auth0.getSession(req);
  const user = session.user.sub;
  const url = new URL(req.url);
  const rate = url.searchParams.get("rate");
  const project = url.searchParams.get("project");
  const activityType = url.searchParams.get("activity_type");
  const activityHourlyRate = url.searchParams.get("activity_hourly_rate");

  console.log("startEntry--------------------", user);
  await startEntry(
    user,
    rate ? parseFloat(rate) : null,
    project,
    activityType,
    activityHourlyRate ? parseFloat(activityHourlyRate) : null
  );
  return NextResponse.redirect(new URL(`/my`, req.url), 302);
});

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  const session = await auth0.getSession(req);
  const user = session.user.sub;
  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);

  // Support both query params and body
  const rate = body.rate || url.searchParams.get("rate");
  const project = body.project || url.searchParams.get("project");
  const activityType =
    body.activity_type || url.searchParams.get("activity_type");
  const activityHourlyRate =
    body.activity_hourly_rate || url.searchParams.get("activity_hourly_rate");

  const entry = await startEntry(
    user,
    rate ? parseFloat(rate) : null,
    project,
    activityType,
    activityHourlyRate ? parseFloat(activityHourlyRate) : null
  );
  return NextResponse.json({
    status: "running",
    user,
    startedAt: entry.start_time,
  });
});
