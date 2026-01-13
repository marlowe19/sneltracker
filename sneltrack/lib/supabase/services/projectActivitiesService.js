/**
 * Project Activities Service for Supabase
 * Handles all project activity operations
 */

import { supabaseServer } from "@/lib/supabaseServer";

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

