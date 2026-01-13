import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { supabaseServer } from "@/lib/supabaseServer";

export const GET = auth0.withApiAuthRequired(async (request) => {
  try {
    const session = await auth0.getSession(request);
    const user = session.user.sub;

    // Define 2025 date range
    const startDate = new Date("2025-01-01T00:00:00.000Z");
    const endDate = new Date("2026-01-01T00:00:00.000Z");

    // First, get all shared projects owned by the user
    const { data: ownedProjects, error: projectsError } = await supabaseServer
      .from("projects")
      .select("id")
      .eq("owner_name", user)
      .eq("is_shared", true);

    if (projectsError) {
      console.error("Error fetching owned projects:", projectsError);
    }

    const ownedProjectIds = ownedProjects?.map((p) => p.id) || [];

    // Get user's own entries
    const { data: userEntries, error: userEntriesError } = await supabaseServer
      .from("time_entries")
      .select(
        `
        id,
        user_name,
        start_time,
        end_time,
        duration_ms,
        hourly_rate,
        project_id,
        projects:project_id (
          id,
          name,
          owner_name,
          is_shared
        )
      `
      )
      .eq("user_name", user)
      .gte("start_time", startDate.toISOString())
      .lt("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    // Get entries from shared projects the user owns
    let projectEntries = [];
    if (ownedProjectIds.length > 0) {
      const { data: projEntries, error: projEntriesError } = await supabaseServer
        .from("time_entries")
        .select(
          `
          id,
          user_name,
          start_time,
          end_time,
          duration_ms,
          hourly_rate,
          project_id,
          projects:project_id (
            id,
            name,
            owner_name,
            is_shared
          )
        `
        )
        .in("project_id", ownedProjectIds)
        .gte("start_time", startDate.toISOString())
        .lt("start_time", endDate.toISOString())
        .order("start_time", { ascending: true });

      if (!projEntriesError && projEntries) {
        projectEntries = projEntries;
      }
    }

    // Combine and deduplicate entries
    const allEntries = [...(userEntries || []), ...projectEntries];
    const entryMap = new Map();
    for (const entry of allEntries) {
      if (!entryMap.has(entry.id)) {
        entryMap.set(entry.id, entry);
      }
    }
    const filteredEntries = Array.from(entryMap.values());

    if (userEntriesError) {
      console.error("Error fetching wrapped data:", userEntriesError);
      return NextResponse.json(
        { error: userEntriesError.message || "Failed to fetch wrapped data" },
        { status: 500 }
      );
    }

    if (!filteredEntries || filteredEntries.length === 0) {
      return NextResponse.json({
        totalMoney: 0,
        totalHours: 0,
        mostWorkedProject: null,
        longestDay: null,
      });
    }

    // Calculate statistics
    let totalMoney = 0;
    let totalHours = 0;
    const projectHours = new Map(); // project_id -> { name, hours }
    const dayHours = new Map(); // date string -> hours

    for (const entry of filteredEntries) {
      const durationMs = entry.duration_ms || 0;
      if (durationMs <= 0) continue;

      const hours = durationMs / (1000 * 60 * 60);
      totalHours += hours;

      // Calculate money if hourly_rate exists
      if (entry.hourly_rate) {
        totalMoney += hours * entry.hourly_rate;
      }

      // Track project hours
      if (entry.project_id) {
        const project = entry.projects;
        const projectName = project?.name || "Unknown Project";
        if (!projectHours.has(entry.project_id)) {
          projectHours.set(entry.project_id, { name: projectName, hours: 0 });
        }
        const projectData = projectHours.get(entry.project_id);
        projectData.hours += hours;
      }

      // Track day hours
      if (entry.start_time) {
        const date = new Date(entry.start_time);
        const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
        if (!dayHours.has(dateStr)) {
          dayHours.set(dateStr, 0);
        }
        dayHours.set(dateStr, dayHours.get(dateStr) + hours);
      }
    }

    // Find most worked project
    let mostWorkedProject = null;
    let maxProjectHours = 0;
    for (const [projectId, projectData] of projectHours.entries()) {
      if (projectData.hours > maxProjectHours) {
        maxProjectHours = projectData.hours;
        mostWorkedProject = {
          projectId,
          name: projectData.name,
          hours: projectData.hours,
        };
      }
    }

    // Find longest working day
    let longestDay = null;
    let maxDayHours = 0;
    for (const [dateStr, hours] of dayHours.entries()) {
      if (hours > maxDayHours) {
        maxDayHours = hours;
        longestDay = {
          date: dateStr,
          hours: hours,
        };
      }
    }

    return NextResponse.json({
      totalMoney: Math.round(totalMoney * 100) / 100, // Round to 2 decimals
      totalHours: Math.round(totalHours * 100) / 100,
      mostWorkedProject,
      longestDay,
    });
  } catch (error) {
    console.error("Error in wrapped API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch wrapped data" },
      { status: 500 }
    );
  }
});

