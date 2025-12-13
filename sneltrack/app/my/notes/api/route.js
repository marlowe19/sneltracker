import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserProjectsWithStats } from "@/lib/supabase/services/projectsService";
import { auth0 } from "@/lib/auth/auth0";
export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const session = await auth0.getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user.nickname;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const dueDate = url.searchParams.get("dueDate");

    // Build query
    // If startDate and endDate are provided, only select id and due_date for efficiency
    // Otherwise, select all fields for backward compatibility
    const selectFields = startDate && endDate ? "id, due_date" : "*";

    // Start with base query
    let query = supabaseServer.from("notes").select(selectFields);

    // Filter by due_date FIRST (more efficient - reduces data before OR filter)
    if (dueDate) {
      query = query.eq("due_date", dueDate);
    }

    // Filter by project_id if provided (takes precedence over membership check)
    if (projectId) {
      query = query.eq("project_id", projectId);
      // If projectId is specified, also check if user has access
      // For now, we'll still apply the OR filter below to ensure user has access
    }

    // Filter by due_date range if provided (for week view)
    if (startDate && endDate) {
      query = query.gte("due_date", startDate).lte("due_date", endDate);
    }

    // Get all projects where user is owner or member (from Supabase)
    const projects = await getUserProjectsWithStats(user);
    const projectIds = projects.map((p) => p.id).filter(Boolean);

    // Apply OR condition: notes created by user OR notes from user's projects
    if (projectIds.length > 0) {
      // Build OR condition: created_by = user OR project_id IN (projectIds)
      query = query.or(
        `created_by.eq.${user},project_id.in.(${projectIds.join(",")})`
      );
    } else {
      // If no projects, only show notes created by user
      query = query.eq("created_by", user);
    }

    // Only order if we're selecting all fields and not filtering by date range
    if (!startDate || !endDate) {
      query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notes:", error);
      return NextResponse.json(
        { error: "Failed to fetch notes", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: data || [] });
  } catch (error) {
    console.error("Error in notes API:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes", message: error.message },
      { status: 500 }
    );
  }
}
