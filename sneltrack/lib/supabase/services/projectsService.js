/**
 * Projects Service for Supabase
 * Handles all project operations with fire-and-forget pattern
 * Designed to support gradual migration from Firestore
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { fireAndForget, logError, toIsoString } from "./base";

/**
 * Looks up a user ID by username from the users table
 *
 * @param {string} username - Username to look up
 * @returns {Promise<string|null>} User UUID or null if not found
 */
async function lookupUserIdByUsername(username) {
  if (!username) return null;

  // Try common field names for username in users table
  // Common patterns: username, name, user_name, email
  const possibleFields = ["username", "name", "user_name", "email"];

  for (const field of possibleFields) {
    const { data, error } = await supabaseServer
      .from("users")
      .select("id")
      .eq(field, username)
      .single();

    if (!error && data?.id) {
      return data.id;
    }
  }

  // If no field matched, return null
  return null;
}

/**
 * Maps a Firestore project to Supabase schema
 *
 * @param {Object} project - Firestore project object
 * @param {string} userName - Username for user projects, or owner name for shared projects
 * @returns {Promise<Object>} Supabase project object
 */
async function mapProjectToSupabase(project, userName) {
  // Determine owner name: for shared projects use project.owner, for user projects use userName
  const ownerName = project.is_shared ? project.owner : userName;
  
  // Look up owner_id from users table
  const ownerId = await lookupUserIdByUsername(ownerName);

  // Convert numeric fields
  const hourlyRate =
    project.hourly_rate !== null && project.hourly_rate !== undefined
      ? typeof project.hourly_rate === "string"
        ? parseFloat(project.hourly_rate)
        : project.hourly_rate
      : null;

  const budgetHours =
    project.budget_hours !== null && project.budget_hours !== undefined
      ? typeof project.budget_hours === "string"
        ? parseFloat(project.budget_hours)
        : project.budget_hours
      : null;

  return {
    firestore_id: project.id,
    name: project.name,
    owner_id: ownerId,
    owner_name: ownerName,
    hourly_rate: hourlyRate,
    budget_hours: budgetHours,
    is_shared: project.is_shared ?? false,
    is_default: project.is_default ?? false,
    created_at: toIsoString(project.created_at) || new Date().toISOString(),
    modified_at: toIsoString(project.modified_at) || new Date().toISOString(),
  };
}

/**
 * Creates a project in Supabase (fire-and-forget)
 *
 * @param {Object} project - Firestore project object
 * @param {string} userName - Username for user projects, or owner name for shared projects
 */
export function create(project, userName) {
  fireAndForget(
    async () => {
      const supabaseData = await mapProjectToSupabase(project, userName);

      // If owner_id lookup failed, skip the operation
      if (!supabaseData.owner_id) {
        throw new Error(
          `Cannot create project: owner_id not found for username "${supabaseData.owner_name}"`
        );
      }

      const { error } = await supabaseServer
        .from("projects")
        .insert(supabaseData);

      if (error) {
        throw error;
      }
    },
    "project",
    "create",
    project.id
  );
}

/**
 * Updates a project in Supabase (fire-and-forget)
 * TEMPORARY MIGRATION CODE: Uses upsert to create if doesn't exist, update if it does.
 * This ensures projects are synced even if they haven't been created in Supabase yet.
 * TODO: Remove this migration code after migration is complete - change to regular update.
 *
 * @param {Object} project - Firestore project object with updated data
 * @param {string} userName - Username for user projects, or owner name for shared projects
 */
export function update(project, userName) {
  fireAndForget(
    async () => {
      const supabaseData = await mapProjectToSupabase(project, userName);

      // If owner_id lookup failed, skip the operation
      if (!supabaseData.owner_id) {
        throw new Error(
          `Cannot update project: owner_id not found for username "${supabaseData.owner_name}"`
        );
      }

      // TEMPORARY MIGRATION CODE: Use upsert to create if doesn't exist, update if it does
      // Update modified_at to current time
      supabaseData.modified_at = new Date().toISOString();

      // Use upsert to create if doesn't exist, update if it does
      const { error } = await supabaseServer
        .from("projects")
        .upsert(supabaseData, {
          onConflict: "firestore_id",
        });

      if (error) {
        throw error;
      }
    },
    "project",
    "update",
    project.id
  );
}

/**
 * Upserts a project in Supabase using firestore_id (fire-and-forget)
 * Useful for handling retries and ensuring idempotency
 *
 * @param {Object} project - Firestore project object
 * @param {string} userName - Username for user projects, or owner name for shared projects
 */
export function upsert(project, userName) {
  fireAndForget(
    async () => {
      const supabaseData = await mapProjectToSupabase(project, userName);

      // If owner_id lookup failed, skip the operation
      if (!supabaseData.owner_id) {
        throw new Error(
          `Cannot upsert project: owner_id not found for username "${supabaseData.owner_name}"`
        );
      }

      // Update modified_at to current time for upsert
      supabaseData.modified_at = new Date().toISOString();

      const { error } = await supabaseServer
        .from("projects")
        .upsert(supabaseData, {
          onConflict: "firestore_id",
        });

      if (error) {
        throw error;
      }
    },
    "project",
    "upsert",
    project.id
  );
}

