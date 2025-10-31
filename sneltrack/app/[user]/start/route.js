import { NextResponse } from "next/server";
import { startEntry } from "@/lib/dbFirestore";

export async function GET(req, context) {
  const { user } = await context.params;
  const url = new URL(req.url);
  const rate = url.searchParams.get("rate");
  const project = url.searchParams.get("project");

  console.log("startEntry--------------------", user);
  await startEntry(user, rate, project);

  return NextResponse.redirect(
    new URL(`/${encodeURIComponent(user)}`, req.url),
    302
  );
}

export async function POST(req, context) {
  const { user } = await context.params;
  const url = new URL(req.url);
  const rate = url.searchParams.get("rate");
  const project = url.searchParams.get("project");

  const entry = await startEntry(user, rate, project);
  return NextResponse.json({
    status: "running",
    user,
    startedAt: entry.start_time,
  });
}
