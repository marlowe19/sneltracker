import { NextResponse } from "next/server";
import { startEntry } from "@/lib/supabase/services/timeEntriesService";
import { auth0 } from "@/lib/auth/auth0";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  const session = await auth0.getSession(req);
  const user = session.user.sub;
  const url = new URL(req.url);
  const rate = url.searchParams.get("rate");
  const project = url.searchParams.get("project");

  console.log("startEntry--------------------", user);
  //await startEntry(user, rate, project);
  await startEntry(user, rate, project);
  return NextResponse.redirect(
    new URL(`/my`, req.url),
    302
  );
});

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  const session = await auth0.getSession(req);
  const user = session.user.sub;
  const url = new URL(req.url);
  const rate = url.searchParams.get("rate");
  const project = url.searchParams.get("project");

  const entry = await startEntry(user, rate, project);
  return NextResponse.json({
    status: "running",
    user,
    startedAt: entry.start_time,
  });
});
