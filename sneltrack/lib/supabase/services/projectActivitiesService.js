/**
 * Project Activities Service for Supabase
 * Handles all project activity operations
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { getProjectDetail } from "./projectsService";

function coerceHourlyRate(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve project activity row for rate lookup (by user_activity_id, then name).
 * @returns {Promise<{ id: string, hourly_rate: unknown }|null>}
 */
export async function findProjectActivityRowForRate(
  projectId,
  activityType,
  userActivityId
) {
  if (!projectId) return null;
  if (userActivityId) {
    const { data: byUa } = await supabaseServer
      .from("project_activities")
      .select("id, hourly_rate")
      .eq("project_id", projectId)
      .eq("user_activity_id", userActivityId)
      .maybeSingle();
    if (byUa) return byUa;
  }
  if (!activityType) return null;
  const { data: byName } = await supabaseServer
    .from("project_activities")
    .select("id, hourly_rate")
    .eq("project_id", projectId)
    .eq("name", activityType)
    .maybeSingle();
  return byName || null;
}

/**
 * Member override (if any) else project_activities.hourly_rate for this viewer.
 * @returns {Promise<number|null>}
 */
export async function resolveEffectiveProjectActivityHourlyRate(
  projectId,
  activityType,
  userActivityId,
  viewerUserName
) {
  const row = await findProjectActivityRowForRate(
    projectId,
    activityType,
    userActivityId
  );
  if (!row) return null;
  const base = coerceHourlyRate(row.hourly_rate);
  if (viewerUserName && row.id) {
    const { data: mr } = await supabaseServer
      .from("project_member_activity_rates")
      .select("hourly_rate")
      .eq("project_activity_id", row.id)
      .eq("user_name", viewerUserName)
      .maybeSingle();
    if (mr?.hourly_rate != null) {
      const override = coerceHourlyRate(mr.hourly_rate);
      if (override != null) return override;
    }
  }
  return base;
}

/**
 * @returns {Promise<Record<string, Record<string, number>>>} activityId -> user_name -> hourly_rate
 */
export async function getMemberActivityRatesBulk(activityIds) {
  if (!activityIds?.length) return {};
  const { data, error } = await supabaseServer
    .from("project_member_activity_rates")
    .select("project_activity_id, user_name, hourly_rate")
    .in("project_activity_id", activityIds);

  if (error) {
    console.error("Error fetching member activity rates:", error);
    throw error;
  }

  const out = {};
  for (const row of data || []) {
    if (!out[row.project_activity_id]) {
      out[row.project_activity_id] = {};
    }
    const r = coerceHourlyRate(row.hourly_rate);
    if (r != null) {
      out[row.project_activity_id][row.user_name] = r;
    }
  }
  return out;
}

/** Use with getMemberActivityRatesBulk for GET /activities (no N+1 queries). */
export function effectiveHourlyRateFromBulk(
  activity,
  bulkByActivityId,
  viewerUserName
) {
  const base = coerceHourlyRate(activity.hourly_rate);
  if (!viewerUserName || !activity?.id) return base;
  const m = bulkByActivityId[activity.id]?.[viewerUserName];
  if (m != null && Number.isFinite(m)) return m;
  return base;
}

export async function isUserProjectParticipant(projectId, userName) {
  if (!projectId || !userName) return false;
  const { data: project, error: pErr } = await supabaseServer
    .from("projects")
    .select("owner_name")
    .eq("id", projectId)
    .maybeSingle();
  if (pErr || !project) return false;
  if (project.owner_name === userName) return true;
  const { data: pm } = await supabaseServer
    .from("project_members")
    .select("user_name")
    .eq("project_id", projectId)
    .eq("user_name", userName)
    .maybeSingle();
  return !!pm;
}

/**
 * Apply per-member activity rates. null/undefined/"" value removes override for that user.
 * @param {string} projectActivityId
 * @param {string} projectId
 * @param {Record<string, number|string|null|undefined>} ratesByUserName
 */
export async function upsertMemberActivityRates(
  projectActivityId,
  projectId,
  ratesByUserName
) {
  if (!projectActivityId || !projectId || !ratesByUserName) return;

  const now = new Date().toISOString();

  for (const [rawName, val] of Object.entries(ratesByUserName)) {
    const user_name = typeof rawName === "string" ? rawName.trim() : "";
    if (!user_name) continue;

    const allowed = await isUserProjectParticipant(projectId, user_name);
    if (!allowed) {
      const err = new Error(`Geen teamlid van dit project: ${user_name}`);
      err.statusCode = 400;
      throw err;
    }

    if (val === null || val === undefined || val === "") {
      const { error } = await supabaseServer
        .from("project_member_activity_rates")
        .delete()
        .eq("project_activity_id", projectActivityId)
        .eq("user_name", user_name);
      if (error) {
        console.error("Error deleting member activity rate:", error);
        throw error;
      }
      continue;
    }

    const num = typeof val === "number" ? val : parseFloat(String(val));
    if (!Number.isFinite(num)) {
      const err = new Error(`Ongeldig tarief voor ${user_name}`);
      err.statusCode = 400;
      throw err;
    }

    const { error } = await supabaseServer
      .from("project_member_activity_rates")
      .upsert(
        {
          project_activity_id: projectActivityId,
          user_name,
          hourly_rate: num,
          modified_at: now,
          created_at: now,
        },
        { onConflict: "project_activity_id,user_name" }
      );

    if (error) {
      console.error("Error upserting member activity rate:", error);
      throw error;
    }
  }
}

/**
 * Get all activities for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} Array of project activities
 */
export async function getProjectActivities(projectId) {
  if (!projectId) {
    return [];
  }

  const { data, error } = await supabaseServer
    .from("project_activities")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching project activities:", error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new project activity
 * @param {string} projectId - Project UUID
 * @param {Object} activityData - Activity data
 * @param {string} activityData.name - Activity name
 * @param {number|null} activityData.hourly_rate - Hourly rate
 * @param {string|null} activityData.icon - Icon name
 * @param {string|null} activityData.color_hex - Color hex code
 * @param {number} activityData.display_order - Display order
 * @returns {Promise<Object>} Created activity
 */
export async function createProjectActivity(projectId, activityData) {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  if (!activityData.name || !activityData.name.trim()) {
    throw new Error("Activity name is required");
  }

  const insertData = {
    project_id: projectId,
    name: activityData.name.trim(),
    hourly_rate: activityData.hourly_rate ?? null,
    icon: activityData.icon || null,
    color_hex: activityData.color_hex || null,
    display_order: activityData.display_order ?? 0,
    user_activity_id: activityData.user_activity_id ?? null,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("project_activities")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating project activity:", error);
    throw error;
  }

  return data;
}

/**
 * Update a project activity
 * @param {string} activityId - Activity UUID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated activity
 */
export async function updateProjectActivity(activityId, updates) {
  if (!activityId) {
    throw new Error("Activity ID is required");
  }

  const updateData = {
    modified_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name.trim();
  }
  if (updates.hourly_rate !== undefined) {
    updateData.hourly_rate = updates.hourly_rate;
  }
  if (updates.icon !== undefined) {
    updateData.icon = updates.icon;
  }
  if (updates.color_hex !== undefined) {
    updateData.color_hex = updates.color_hex;
  }
  if (updates.display_order !== undefined) {
    updateData.display_order = updates.display_order;
  }

  const { data, error } = await supabaseServer
    .from("project_activities")
    .update(updateData)
    .eq("id", activityId)
    .select()
    .single();

  if (error) {
    console.error("Error updating project activity:", error);
    throw error;
  }

  return data;
}

/**
 * Get a project activity by ID
 * @param {string} activityId - Activity UUID
 * @returns {Promise<Object|null>} Activity object or null if not found
 */
export async function getProjectActivityById(activityId) {
  if (!activityId) {
    return null;
  }

  const { data, error } = await supabaseServer
    .from("project_activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching project activity:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a project activity
 * @param {string} activityId - Activity UUID
 * @returns {Promise<void>}
 */
export async function deleteProjectActivity(activityId) {
  if (!activityId) {
    throw new Error("Activity ID is required");
  }

  const { error } = await supabaseServer
    .from("project_activities")
    .delete()
    .eq("id", activityId);

  if (error) {
    console.error("Error deleting project activity:", error);
    throw error;
  }
}

/**
 * @returns {Promise<Object>} Project detail row (throws if no access)
 */
export async function assertUserHasProjectAccess(userName, projectId) {
  const detail = await getProjectDetail(userName, projectId);
  if (!detail) {
    const err = new Error("Project not found or access denied");
    err.statusCode = 403;
    throw err;
  }
  return detail;
}

/**
 * Project owner or project_members.role === 'owner' may manage activities.
 * @returns {Promise<Object>} Project detail
 */
export async function assertUserCanManageProjectActivities(userName, projectId) {
  const detail = await assertUserHasProjectAccess(userName, projectId);
  if (detail.is_owner) return detail;

  const { data: pm, error } = await supabaseServer
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_name", userName)
    .maybeSingle();

  if (error) {
    console.error("Error checking project member role:", error);
    const err = new Error("Access check failed");
    err.statusCode = 500;
    throw err;
  }

  if (pm?.role === "owner") return detail;

  const err = new Error("Not allowed to manage project activities");
  err.statusCode = 403;
  throw err;
}

export async function assertProjectActivityInProject(activityId, projectId) {
  const { data, error } = await supabaseServer
    .from("project_activities")
    .select("id, project_id")
    .eq("id", activityId)
    .maybeSingle();

  if (error) {
    console.error("Error loading project activity:", error);
    throw error;
  }
  if (!data || data.project_id !== projectId) {
    const err = new Error("Activity not found in this project");
    err.statusCode = 404;
    throw err;
  }
}
