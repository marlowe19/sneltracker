/**
 * Agenda Service for Supabase
 * Fetches active projects with all necessary data for AI planning
 */

import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Get active projects for agenda/planning with all calculated fields
 * @param {string} userName - Username to get projects for
 * @param {Date} startDate - Start date of the planning period
 * @param {Date} endDate - End date of the planning period
 * @returns {Promise<Array>} Array of projects with all planning data
 */
export async function getActiveProjectsForAgenda(userName, startDate, endDate) {
  if (!userName) {
    return [];
  }

  // First, get all projects where user is owner or member
  // We need to use a raw query approach since Supabase doesn't support complex OR with subqueries easily
  // Get projects where user is owner
  const { data: ownedProjects, error: ownedError } = await supabaseServer
    .from("projects")
    .select(
      `
      id,
      name,
      zip_code,
      budget_hours,
      priority,
      capacity_per_week,
      due_date,
      start_date,
      archived,
      status,
      owner_name,
      is_shared
    `
    )
    .eq("owner_name", userName)
    .eq("archived", false)
    .eq("status", "active");

  if (ownedError) {
    console.error("Error fetching owned projects:", ownedError);
  }

  // Get project IDs where user is a member
  const { data: memberProjectIds, error: memberError } = await supabaseServer
    .from("project_members")
    .select("project_id")
    .eq("user_name", userName);

  if (memberError) {
    console.error("Error fetching member project IDs:", memberError);
  }

  // Get projects where user is a member
  let memberProjects = [];
  if (memberProjectIds && memberProjectIds.length > 0) {
    const memberIds = memberProjectIds.map((m) => m.project_id);
    const { data: memberProjectsData, error: memberProjectsError } =
      await supabaseServer
        .from("projects")
        .select(
          `
        id,
        name,
        zip_code,
        budget_hours,
        priority,
        capacity_per_week,
        due_date,
        start_date,
        archived,
        status,
        owner_name,
        is_shared
      `
        )
        .in("id", memberIds)
        .eq("archived", false)
        .eq("status", "active");

    if (memberProjectsError) {
      console.error("Error fetching member projects:", memberProjectsError);
    } else {
      memberProjects = memberProjectsData || [];
    }
  }

  // Combine and deduplicate projects
  const projectMap = new Map();

  if (ownedProjects) {
    for (const project of ownedProjects) {
      projectMap.set(project.id, project);
    }
  }

  if (memberProjects && memberProjects.length > 0) {
    for (const project of memberProjects) {
      if (project && !projectMap.has(project.id)) {
        projectMap.set(project.id, project);
      }
    }
  }

  const projects = Array.from(projectMap.values());

  if (!projects || projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((p) => p.id);

  // Get hours spent per project (from all time entries)
  const { data: hoursSpentData, error: hoursError } = await supabaseServer
    .from("time_entries")
    .select("project_id, duration_ms")
    .in("project_id", projectIds);

  if (hoursError) {
    console.error("Error fetching hours spent:", hoursError);
  }

  // Calculate hours spent per project
  const hoursSpentByProject = {};
  if (hoursSpentData) {
    for (const entry of hoursSpentData) {
      if (!entry.project_id || !entry.duration_ms) continue;
      const hours = entry.duration_ms / (1000 * 60 * 60);
      hoursSpentByProject[entry.project_id] =
        (hoursSpentByProject[entry.project_id] || 0) + hours;
    }
  }

  // Get scheduled hours in the date range per project
  const { data: scheduledData, error: scheduledError } = await supabaseServer
    .from("time_entries")
    .select("project_id, duration_ms, start_time")
    .in("project_id", projectIds)
    .gte("start_time", startDate.toISOString())
    .lt("start_time", endDate.toISOString());

  if (scheduledError) {
    console.error("Error fetching scheduled hours:", scheduledError);
  }

  // Calculate scheduled hours per project in date range
  const scheduledHoursByProject = {};
  if (scheduledData) {
    for (const entry of scheduledData) {
      if (!entry.project_id || !entry.duration_ms) continue;
      const hours = entry.duration_ms / (1000 * 60 * 60);
      scheduledHoursByProject[entry.project_id] =
        (scheduledHoursByProject[entry.project_id] || 0) + hours;
    }
  }

  // Get project members with capacities
  const { data: membersData, error: membersError } = await supabaseServer
    .from("project_members")
    .select("project_id, user_name, capacity_per_week, hourly_rate, role")
    .in("project_id", projectIds);

  if (membersError) {
    console.error("Error fetching project members:", membersError);
  }

  // Group members by project
  const membersByProject = {};
  if (membersData) {
    for (const member of membersData) {
      if (!membersByProject[member.project_id]) {
        membersByProject[member.project_id] = [];
      }
      membersByProject[member.project_id].push({
        user_name: member.user_name,
        capacity_per_week: member.capacity_per_week,
        hourly_rate: member.hourly_rate,
        role: member.role,
      });
    }
  }

  // Calculate today for days_until_due
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build result array with all calculated fields
  return projects.map((project) => {
    const hoursSpent = hoursSpentByProject[project.id] || 0;
    const budgetHours = project.budget_hours;
    const hoursRemaining =
      budgetHours !== null && budgetHours !== undefined
        ? Math.max(0, budgetHours - hoursSpent)
        : null;
    const isOverBudget =
      budgetHours !== null &&
      budgetHours !== undefined &&
      hoursSpent > budgetHours;

    // Calculate days until due
    let daysUntilDue = null;
    if (project.due_date) {
      const dueDate = new Date(project.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const scheduledHours = scheduledHoursByProject[project.id] || 0;
    const members = membersByProject[project.id] || [];

    return {
      id: project.id,
      name: project.name,
      zip_code: project.zip_code,
      budget_hours: budgetHours,
      hours_spent: Math.round(hoursSpent * 100) / 100, // Round to 2 decimals
      hours_remaining:
        hoursRemaining !== null ? Math.round(hoursRemaining * 100) / 100 : null,
      priority: project.priority,
      capacity_per_week: project.capacity_per_week,
      due_date: project.due_date,
      start_date: project.start_date,
      days_until_due: daysUntilDue,
      is_over_budget: isOverBudget,
      scheduledHours: Math.round(scheduledHours * 100) / 100, // Round to 2 decimals
      members: members,
    };
  });
}
