/**
 * User Activities Service for Supabase
 * Handles user-level activities (Activiteiten) that can be started without a project
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { lookupUserIdByUsername } from "./projectsService";

function mapRowToClient(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    hourly_rate: row.hourly_rate != null ? Number(row.hourly_rate) : null,
    icon: row.icon ?? null,
    color_hex: row.color_hex ?? null,
    display_order: row.display_order ?? 0,
    archived: row.archived ?? false,
    archived_at: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    modified_at: row.modified_at ? new Date(row.modified_at).toISOString() : null,
  };
}

/**
 * Get all user activities
 * @param {string} userName - Auth0 user sub
 * @param {boolean} includeArchived - Include archived activities
 * @returns {Promise<Array>} User activities
 */
export async function getUserActivities(userName, includeArchived = false) {
  const userId = await lookupUserIdByUsername(userName);
  if (!userId) {
    return [];
  }

  let query = supabaseServer
    .from("user_activities")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching user activities:", error);
    throw error;
  }

  return (data || []).map(mapRowToClient);
}

/**
 * Get a user activity by ID
 * @param {string} activityId - Activity UUID
 * @returns {Promise<Object|null>} User activity or null
 */
export async function getUserActivityById(activityId) {
  if (!activityId) return null;

  const { data, error } = await supabaseServer
    .from("user_activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapRowToClient(data);
}

/**
 * Create a user activity
 * @param {string} userName - Auth0 user sub
 * @param {Object} data - Activity data
 * @param {string} data.name - Activity name
 * @param {number|null} data.hourly_rate - Hourly rate
 * @param {string|null} data.icon - Icon name
 * @param {string|null} data.color_hex - Color hex code
 * @returns {Promise<Object>} Created activity
 */
export async function createUserActivity(userName, data) {
  const userId = await lookupUserIdByUsername(userName);
  if (!userId) {
    throw new Error("User not found");
  }

  if (!data.name || !data.name.trim()) {
    throw new Error("Activity name is required");
  }

  const insertData = {
    user_id: userId,
    name: data.name.trim(),
    hourly_rate: data.hourly_rate ?? null,
    icon: data.icon || null,
    color_hex: data.color_hex || null,
    display_order: data.display_order ?? 0,
    archived: false,
  };

  const { data: created, error } = await supabaseServer
    .from("user_activities")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating user activity:", error);
    throw error;
  }

  return mapRowToClient(created);
}

/**
 * Update a user activity
 * @param {string} userName - Auth0 user sub (for auth check)
 * @param {string} activityId - Activity UUID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated activity
 */
export async function updateUserActivity(userName, activityId, updates) {
  const userId = await lookupUserIdByUsername(userName);
  if (!userId) {
    throw new Error("User not found");
  }

  const { data: existing, error: fetchError } = await supabaseServer
    .from("user_activities")
    .select("user_id")
    .eq("id", activityId)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Activity ${activityId} not found`);
  }

  if (existing.user_id !== userId) {
    throw new Error("Unauthorized: Activity does not belong to user");
  }

  const updateData = {};
  if (updates.name !== undefined) updateData.name = updates.name.trim();
  if (updates.hourly_rate !== undefined) updateData.hourly_rate = updates.hourly_rate;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color_hex !== undefined) updateData.color_hex = updates.color_hex;
  if (updates.display_order !== undefined) updateData.display_order = updates.display_order;
  if (updates.archived !== undefined) {
    updateData.archived = updates.archived;
    updateData.archived_at = updates.archived ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseServer
    .from("user_activities")
    .update(updateData)
    .eq("id", activityId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user activity:", error);
    throw error;
  }

  return mapRowToClient(data);
}

/**
 * Archive a user activity
 * @param {string} userName - Auth0 user sub
 * @param {string} activityId - Activity UUID
 * @returns {Promise<Object>} Updated activity
 */
export async function archiveUserActivity(userName, activityId) {
  return updateUserActivity(userName, activityId, { archived: true });
}

/**
 * Unarchive a user activity
 * @param {string} userName - Auth0 user sub
 * @param {string} activityId - Activity UUID
 * @returns {Promise<Object>} Updated activity
 */
export async function unarchiveUserActivity(userName, activityId) {
  return updateUserActivity(userName, activityId, { archived: false });
}

/**
 * Delete a user activity (only if not used by timer_activities)
 * @param {string} userName - Auth0 user sub
 * @param {string} activityId - Activity UUID
 */
export async function deleteUserActivity(userName, activityId) {
  const userId = await lookupUserIdByUsername(userName);
  if (!userId) {
    throw new Error("User not found");
  }

  const { data: existing, error: fetchError } = await supabaseServer
    .from("user_activities")
    .select("user_id")
    .eq("id", activityId)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Activity ${activityId} not found`);
  }

  if (existing.user_id !== userId) {
    throw new Error("Unauthorized: Activity does not belong to user");
  }

  // Check if used by timer_activities
  const { count, error: countError } = await supabaseServer
    .from("timer_activities")
    .select("*", { count: "exact", head: true })
    .eq("user_activity_id", activityId);

  if (!countError && count > 0) {
    throw new Error("Cannot delete: activity is used by time entries. Archive it instead.");
  }

  const { error } = await supabaseServer
    .from("user_activities")
    .delete()
    .eq("id", activityId);

  if (error) {
    console.error("Error deleting user activity:", error);
    throw error;
  }
}
