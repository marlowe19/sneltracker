/**
 * Time Entries Service for Supabase
 * Handles all time entry operations with fire-and-forget pattern
 * Designed to support gradual migration from Firestore
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { fireAndForget, logError, toIsoString } from "./base";

/**
 * Looks up a Supabase project UUID by Firestore project ID
 *
 * @param {string} firestoreProjectId - Firestore project ID
 * @returns {Promise<string|null>} Project UUID or null if not found
 */
async function lookupProjectId(firestoreProjectId) {
  if (!firestoreProjectId) return null;

  const { data, error } = await supabaseServer
    .from("projects")
    .select("id")
    .eq("firestore_id", firestoreProjectId)
    .single();

  if (error || !data) {
    // Silently return null - project might not be migrated yet
    return null;
  }

  return data.id;
}

/**
 * Looks up project information and determines hourly rate
 * Handles both Supabase UUID and Firestore ID lookups
 * Verifies shared project membership
 *
 * @param {string} userName - Username
 * @param {string|null} project - Project identifier (Firestore ID or Supabase UUID)
 * @param {number|null} providedHourlyRate - Optional hourly rate provided by caller
 * @returns {Promise<Object>} Object with { supabaseProjectId, firestoreProjectId, finalHourlyRate }
 */
async function resolveProjectAndRate(
  userName,
  project,
  providedHourlyRate = null
) {
  let finalHourlyRate = providedHourlyRate;
  let supabaseProjectId = null;
  let firestoreProjectId = null;

  if (!project) {
    return {
      supabaseProjectId: null,
      firestoreProjectId: null,
      finalHourlyRate,
    };
  }

  // Resolve project by Supabase UUID only
  const { data: projectData, error: projectError } = await supabaseServer
    .from("projects")
    .select("id, firestore_id")
    .eq("id", project)
    .single();

  if (projectError || !projectData) {
    throw new Error(`Project not found: ${project}`);
  }

  supabaseProjectId = projectData.id;
  firestoreProjectId = projectData.firestore_id;

  // Use get_project_detail RPC to get all rate info in one call
  // This also validates that the user is either owner or member
  const { data: projectDetail, error: detailError } = await supabaseServer.rpc(
    "get_project_detail",
    {
      p_user_name: userName,
      p_project_id: supabaseProjectId,
      p_start_date: null,
      p_end_date: null,
    }
  );

  if (detailError) {
    console.error("Error fetching project detail:", detailError);
    throw new Error(`Error accessing project: ${detailError.message}`);
  }

  if (!projectDetail || projectDetail.length === 0) {
    // User is not owner or member - not authorized
    throw new Error("User is not authorized to use this project");
  }

  const detail = projectDetail[0];
  const isShared = detail.is_shared ?? false;

  // Determine final rate: member rate > project rate > provided rate
  if (isShared) {
    // For shared projects: member rate takes priority
    if (
      detail.member_hourly_rate !== null &&
      detail.member_hourly_rate !== undefined
    ) {
      finalHourlyRate = detail.member_hourly_rate;
    } else if (
      detail.hourly_rate !== null &&
      detail.hourly_rate !== undefined
    ) {
      finalHourlyRate = detail.hourly_rate;
    }
  } else {
    // For non-shared projects: use project rate if available
    if (detail.hourly_rate !== null && detail.hourly_rate !== undefined) {
      finalHourlyRate = detail.hourly_rate;
    }
  }

  return { supabaseProjectId, firestoreProjectId, finalHourlyRate };
}

/**
 * Inserts a time entry and returns it with project access info
 *
 * @param {Object} entryData - Entry data to insert
 * @param {string} userName - Username for project access lookup
 * @returns {Promise<Object>} Created entry with project access info
 */
async function insertEntryWithProjectInfo(entryData, userName) {
  // Insert the entry
  const { data: insertedEntry, error: insertError } = await supabaseServer
    .from("time_entries")
    .insert(entryData)
    .select()
    .single();

  if (insertError) {
    console.error("Error creating time entry in Supabase:", insertError);
    throw insertError;
  }

  // Get project access info if project exists
  let projectName = null;
  let isProjectOwner = false;
  let isProjectMember = false;

  if (insertedEntry.project_id) {
    const { data: accessInfo, error: accessError } = await supabaseServer
      .rpc("get_project_access", {
        p_project_id: insertedEntry.project_id,
        p_user_name: userName,
      })
      .single();

    if (!accessError && accessInfo) {
      projectName = accessInfo.project_name;
      isProjectOwner = accessInfo.is_project_owner;
      isProjectMember = accessInfo.is_project_member;
    }
  }

  // Return entry in the same format as getDayEntries
  return {
    id: insertedEntry.id, // Supabase UUID
    user_name: insertedEntry.user_name,
    start_time: insertedEntry.start_time,
    end_time: insertedEntry.end_time,
    duration_ms: insertedEntry.duration_ms ?? null,
    hourly_rate: insertedEntry.hourly_rate ?? null,
    project: insertedEntry.firestore_project_id ?? null, // Firestore project ID
    project_id: insertedEntry.project_id ?? null, // Supabase project UUID
    project_name: projectName,
    billable: insertedEntry.billable ?? true,
    isProjectOwner: isProjectOwner,
    isProjectMember: isProjectMember,
    created_at: insertedEntry.created_at,
    modified_at: insertedEntry.modified_at,
    creation_method: insertedEntry.creation_method ?? null,
    is_running: insertedEntry.is_running ?? false,
    firestore_id: insertedEntry.firestore_id,
  };
}

/**
 * Maps a Firestore time entry to Supabase schema
 *
 * @param {Object} entry - Firestore entry object
 * @returns {Promise<Object>} Supabase entry object
 */
export async function mapEntryToSupabase(entry) {
  // // Look up the Supabase project UUID from firestore_id
  // const projectId = await lookupProjectId(entry.project);

  return {
    firestore_id: entry.id,
    user_name: entry.user_name,
    start_time: toIsoString(entry.start_time),
    end_time: toIsoString(entry.end_time),
    duration_ms: entry.duration_ms ?? null,
    hourly_rate: entry.hourly_rate ?? null,
    project_id: entry.project, // ✅ Now properly linked to Supabase project
    firestore_project_id: entry.project, // Keep for reference/fallback
    billable: entry.billable ?? true, // Default to billable
    created_at: toIsoString(entry.created_at) || new Date().toISOString(),
    modified_at: toIsoString(entry.modified_at) || new Date().toISOString(),
    creation_method: entry.creation_method ?? null,
    is_running: entry.is_running ?? false,
  };
}

export async function mapEntryToSupabaseUpdate(entry) {
  return {
    firestore_id: entry.id,
    user_name: entry.user_name,
    start_time: toIsoString(entry.start_time),
    end_time: toIsoString(entry.end_time),
    duration_ms: entry.duration_ms ?? null,
    hourly_rate: entry.hourly_rate ?? null,
    project_id: entry.project, // ✅ Now properly linked to Supabase project
    firestore_project_id: entry.project, // Keep for reference/fallback,
    billable: entry.billable ?? true, // Default to billable
    modified_at: new Date().toISOString(),
    creation_method: entry.creation_method ?? null,
    is_running: entry.is_running ?? false,
  };
}
/**
 * Creates a time entry in Supabase (fire-and-forget)
 *
 * @param {Object} entry - Firestore entry object
 */
export function create(entry) {
  fireAndForget(
    async () => {
      const supabaseData = await mapEntryToSupabase(entry);
      const { error } = await supabaseServer
        .from("time_entries")
        .insert(supabaseData);

      if (error) {
        throw error;
      }
    },
    "time_entry",
    "create",
    entry.id
  );
}

/**
 * Updates a time entry in Supabase (fire-and-forget)
 *
 * @param {Object} entry - Firestore entry object with updated data
 */
export function update(entry) {
  fireAndForget(
    async () => {
      const supabaseData = await mapEntryToSupabase(entry);
      // Remove firestore_id from update data (it's the identifier, not updatable)
      const { firestore_id, ...updateData } = supabaseData;
      // Update modified_at to current time
      updateData.modified_at = new Date().toISOString();

      const { error } = await supabaseServer
        .from("time_entries")
        .update(updateData)
        .eq("firestore_id", entry.id);

      if (error) {
        throw error;
      }
    },
    "time_entry",
    "update",
    entry.id
  );
}
export async function updateEntry(userName, entryId, updates) {
  // Transform updates to Supabase format - minimal changes needed
  const fieldsToUpdate = { ...updates };

  // project_id is already correct (from ...updates), look up firestore_project_id if project_id is being updated
  if (updates.project_id !== undefined) {
    // Get current entry to check if project is actually changing and get existing hourly_rate
    const { data: currentEntry } = await supabaseServer
      .from("time_entries")
      .select("hourly_rate, project_id")
      .eq("id", entryId)
      .single();

    const oldProjectId = currentEntry?.project_id;

    // If project_id is set, look up the corresponding firestore_id and determine rate
    if (updates.project_id) {
      // Resolve project by Supabase UUID only
      const { data: projectData, error: projectError } = await supabaseServer
        .from("projects")
        .select("id, firestore_id")
        .eq("id", updates.project_id)
        .single();

      if (projectError || !projectData) {
        // Project not found, clear both
        fieldsToUpdate.project_id = null;
        fieldsToUpdate.firestore_project_id = null;
      } else {
        fieldsToUpdate.firestore_project_id = projectData.firestore_id;

        // If project is changing and hourly_rate not explicitly provided, determine it
        if (
          oldProjectId !== projectData.id &&
          updates.hourly_rate === undefined
        ) {
          // Use get_project_detail RPC to get all rate info in one call
          const { data: projectDetail, error: detailError } =
            await supabaseServer.rpc("get_project_detail", {
              p_user_name: userName,
              p_project_id: projectData.id,
              p_start_date: null,
              p_end_date: null,
            });

          if (!detailError && projectDetail && projectDetail.length > 0) {
            const detail = projectDetail[0];
            let finalHourlyRate = currentEntry?.hourly_rate ?? null;

            if (detail.is_shared) {
              // For shared projects: member rate takes priority
              if (
                detail.member_hourly_rate !== null &&
                detail.member_hourly_rate !== undefined
              ) {
                finalHourlyRate = detail.member_hourly_rate;
              } else if (
                detail.hourly_rate !== null &&
                detail.hourly_rate !== undefined
              ) {
                finalHourlyRate = detail.hourly_rate;
              }
            } else {
              // For non-shared projects: use project rate if available
              if (
                detail.hourly_rate !== null &&
                detail.hourly_rate !== undefined
              ) {
                finalHourlyRate = detail.hourly_rate;
              }
            }

            if (finalHourlyRate !== null && finalHourlyRate !== undefined) {
              fieldsToUpdate.hourly_rate = finalHourlyRate;
            }
          }
        }
      }
    } else {
      // project_id is null, clear firestore_project_id too
      fieldsToUpdate.firestore_project_id = null;
    }
  }

  // Always update modified_at
  fieldsToUpdate.modified_at = new Date().toISOString();

  // Don't update these fields (they're identifiers/metadata/computed fields)
  delete fieldsToUpdate.firestore_id;
  delete fieldsToUpdate.user_name;
  delete fieldsToUpdate.id;
  // Filter out computed/read-only fields that aren't database columns
  delete fieldsToUpdate.project_name; // Computed from projects table
  delete fieldsToUpdate.isProjectOwner; // Computed from RPC call
  delete fieldsToUpdate.isProjectMember; // Computed from RPC call
  delete fieldsToUpdate.project; // This is firestore_project_id, handled via project_id

  // Update the entry
  const { data: updatedEntry, error: updateError } = await supabaseServer
    .from("time_entries")
    .update(fieldsToUpdate)
    .eq("id", entryId)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating entry in Supabase:", updateError);
    throw updateError;
  }

  // Get project access info in one call
  if (updatedEntry.project_id) {
    const { data: accessInfo, error: accessError } = await supabaseServer
      .rpc("get_project_access", {
        p_project_id: updatedEntry.project_id,
        p_user_name: userName,
      })
      .single();

    if (!accessError && accessInfo) {
      updatedEntry.project_name = accessInfo.project_name;
      updatedEntry.is_project_owner = accessInfo.is_project_owner;
      updatedEntry.is_project_member = accessInfo.is_project_member;
    } else {
      updatedEntry.project_name = null;
      updatedEntry.is_project_owner = false;
      updatedEntry.is_project_member = false;
    }
  } else {
    updatedEntry.project_name = null;
    updatedEntry.is_project_owner = false;
    updatedEntry.is_project_member = false;
  }

  // Map to match the format expected by the client (same as getDayEntries)
  return {
    id: updatedEntry.id,
    user_name: updatedEntry.user_name,
    start_time: updatedEntry.start_time,
    end_time: updatedEntry.end_time,
    duration_ms: updatedEntry.duration_ms ?? null,
    hourly_rate: updatedEntry.hourly_rate ?? null,
    project: updatedEntry.firestore_project_id ?? null, // Firestore project ID
    project_id: updatedEntry.project_id ?? null, // Supabase project UUID
    project_name: updatedEntry.project_name ?? null, // Project name for display
    billable: updatedEntry.billable ?? true, // Billable status
    isProjectOwner: updatedEntry.is_project_owner ?? false,
    isProjectMember: updatedEntry.is_project_member ?? false,
    created_at: updatedEntry.created_at,
    modified_at: updatedEntry.modified_at,
    creation_method: updatedEntry.creation_method ?? null,
    is_running: updatedEntry.is_running ?? false,
    firestore_id: updatedEntry.firestore_id,
  };
}

/**
 * Deletes a time entry from Supabase
 * User can delete if:
 * - Entry belongs to user (user_name matches), OR
 * - Entry belongs to a shared project where user is the owner
 *
 * @param {string} userName - Username deleting the entry
 * @param {string} entryId - Supabase UUID of the entry to delete
 * @returns {Promise<void>}
 * @throws {Error} If entry not found or user lacks permission
 */
export async function deleteEntry(userName, entryId) {
  // First, fetch the entry to verify it exists
  const { data: entry, error: fetchError } = await supabaseServer
    .from("time_entries")
    .select("id, user_name, project_id")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    throw new Error(`Entry ${entryId} not found`);
  }

  // Check if user owns the entry
  const userOwnsEntry = entry.user_name === userName;

  // If entry has a project, check if user is project owner
  let isProjectOwner = false;
  if (entry.project_id) {
    const { data: accessInfo, error: accessError } = await supabaseServer
      .rpc("get_project_access", {
        p_project_id: entry.project_id,
        p_user_name: userName,
      })
      .single();

    if (!accessError && accessInfo) {
      isProjectOwner = accessInfo.is_project_owner ?? false;
    }
  }

  // Verify user has permission to delete
  if (!userOwnsEntry && !isProjectOwner) {
    throw new Error(
      `User ${userName} does not have permission to delete entry ${entryId}`
    );
  }

  // Delete the entry
  const { error: deleteError } = await supabaseServer
    .from("time_entries")
    .delete()
    .eq("id", entryId);

  if (deleteError) {
    console.error("Error deleting entry in Supabase:", deleteError);
    throw deleteError;
  }
}

/**
 * Upserts a time entry in Supabase using firestore_id (fire-and-forget)
 * Useful for handling retries and ensuring idempotency
 *
 * @param {Object} entry - Firestore entry object
 */
export function upsert(entry) {
  fireAndForget(
    async () => {
      const supabaseData = await mapEntryToSupabase(entry);
      // Update modified_at to current time for upsert
      supabaseData.modified_at = new Date().toISOString();

      const { error } = await supabaseServer
        .from("time_entries")
        .upsert(supabaseData, {
          onConflict: "firestore_id",
        });

      if (error) {
        throw error;
      }
    },
    "time_entry",
    "upsert",
    entry.id
  );
}

/**
 * Gets day entries for a user from Supabase
 * Replaces getTimeEntries() from Firestore
 *
 * @param {string} userName - Username to get entries for
 * @param {Date} dayDate - Date object representing the day (will be used to extract date part)
 * @returns {Promise<Array>} Array of time entries matching Firestore format
 */
export async function getDayEntries(userName, dayDate) {
  // Extract date part (YYYY-MM-DD) from the Date object
  const year = dayDate.getFullYear();
  const month = String(dayDate.getMonth() + 1).padStart(2, "0");
  const day = String(dayDate.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  // what the query needs to do is get all the entries for the user for the given day.
  // if a user is the owner of a project they should see all the entries for the project for the given day.

  const { data, error } = await supabaseServer.rpc("get_day_entries", {
    p_user_name: userName,
    p_day_date: dateStr,
  });

  if (error) {
    console.error("Error fetching day entries:", error);
    throw error;
  }

  // Return entries with Supabase UUID as primary identifier (clean cutover)
  return (data || []).map((row) => ({
    id: row.id, // Use Supabase UUID as the entry ID
    user_name: row.user_name,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_ms: row.duration_ms ?? null,
    hourly_rate: row.hourly_rate ?? null,
    project: row.project ?? null, // Firestore project ID (still used for project reference)
    project_id: row.project_id ?? null, // ✅ Supabase project UUID (for dropdowns)
    project_name: row.project_name ?? null, // Project name for display
    billable: row.billable ?? true, // Billable status (default to true)
    isProjectOwner: row.is_project_owner ?? false, // ✅ From database
    isProjectMember: row.is_project_member ?? false, // ✅ From database
    created_at: row.created_at,
    modified_at: row.modified_at,
    creation_method: row.creation_method ?? null,
    is_running: row.is_running ?? false,
    firestore_id: row.firestore_id, // Keep as metadata for sync operations
  }));
}

/**
 * Gets week entries for a user from Supabase
 * Replaces getWeekEntries() from Firestore
 * Returns entries that overlap the week range (not just entries starting in the week)
 *
 * @param {string} userName - Username to get entries for
 * @param {string} weekStartIso - ISO string for week start (e.g., "2024-01-01T00:00:00.000Z")
 * @param {string} weekEndIso - ISO string for week end (e.g., "2024-01-08T00:00:00.000Z")
 * @returns {Promise<Array>} Array of time entries matching Firestore format
 */
export async function getWeekEntries(userName, weekStartIso, weekEndIso) {
  const { data, error } = await supabaseServer.rpc("get_week_entries", {
    p_user_name: userName,
    p_week_start: weekStartIso,
    p_week_end: weekEndIso,
  });

  if (error) {
    console.error("Error fetching week entries:", error);
    throw error;
  }

  // Return entries with Supabase UUID as primary identifier (clean cutover)
  return (data || []).map((row) => ({
    id: row.id, // Use Supabase UUID as the entry ID
    user_name: row.user_name,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_ms: row.duration_ms ?? null,
    hourly_rate: row.hourly_rate ?? null,
    project: row.project ?? null, // Firestore project ID (still used for project reference)
    project_id: row.project_id ?? null, // ✅ Supabase project UUID (for dropdowns)
    project_name: row.project_name ?? null, // Project name for display
    billable: row.billable ?? true, // Billable status (default to true)
    isProjectOwner: row.is_project_owner ?? false, // ✅ From database
    isProjectMember: row.is_project_member ?? false, // ✅ From database
    created_at: row.created_at,
    modified_at: row.modified_at,
    creation_method: row.creation_method ?? null,
    is_running: row.is_running ?? false,
    firestore_id: row.firestore_id, // Keep as metadata for sync operations
  }));
}

/**
 * Gets all active (running) time entries for a user from Supabase
 * Only returns entries owned by the user
 * Replaces getActiveEntries() from Firestore
 *
 * @param {string} userName - Username to get active entries for
 * @returns {Promise<Array>} Array of active time entries matching Firestore format
 */
export async function getActiveEntries(userName) {
  const { data, error } = await supabaseServer
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
      firestore_project_id,
      billable,
      created_at,
      modified_at,
      creation_method,
      is_running,
      firestore_id,
      projects:project_id (
        id,
        name,
        owner_name
      )
    `
    )
    .eq("user_name", userName)
    .eq("is_running", true)
    .eq("creation_method", "timer")
    .order("start_time", { ascending: false });

  if (error) {
    console.error("Error fetching active entries:", error);
    throw error;
  }

  // Map entries with project info from the join
  return (data || []).map((row) => {
    const project = row.projects;

    return {
      id: row.id,
      user_name: row.user_name,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_ms: row.duration_ms ?? null,
      hourly_rate: row.hourly_rate ?? null,
      project: row.firestore_project_id ?? null, // Firestore project ID
      project_id: row.project_id ?? null, // Supabase project UUID
      project_name: project?.name ?? null,
      billable: row.billable ?? true,
      isProjectOwner: project ? project.owner_name === userName : false,
      isProjectMember: false, // Not needed for user's own entries
      created_at: row.created_at,
      modified_at: row.modified_at,
      creation_method: row.creation_method ?? null,
      is_running: row.is_running ?? false,
      firestore_id: row.firestore_id,
    };
  });
}

/**
 * Creates a manual time entry in Supabase
 * Creates a non-running entry with is_running = false and creation_method = "manual"
 *
 * @param {string} userName - Username creating the entry
 * @param {Date|string} dayDate - Date for the entry (used if startTime not provided)
 * @param {number|null} durationMs - Optional duration in milliseconds
 * @param {number|null} hourlyRate - Optional hourly rate (will be overridden by project/member rate if available)
 * @param {string|null} project - Project identifier (Firestore ID or Supabase UUID)
 * @param {Date|string|null} startTime - Optional start time (defaults to start of dayDate)
 * @param {Date|string|null} endTime - Optional end time (calculated from duration if not provided)
 * @returns {Promise<Object>} Created time entry matching Firestore format
 */
export async function createEntry(
  userName,
  dayDate,
  durationMs = null,
  hourlyRate = null,
  project = null,
  startTime = null,
  endTime = null
) {
  const now = new Date();

  // Use provided start_time if available, otherwise set to start of the selected day
  let dayStart;
  if (startTime) {
    dayStart = startTime instanceof Date ? startTime : new Date(startTime);
  } else {
    // Parse dayDate and create UTC midnight for that date to avoid timezone issues
    const dateObj = dayDate instanceof Date ? dayDate : new Date(dayDate);
    // Extract date components in UTC to avoid timezone issues
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth();
    const day = dateObj.getUTCDate();
    // Create new date at UTC midnight for the selected date
    dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    console.log("------dayStart------", dayStart);
  }

  // Use provided end_time if available, otherwise calculate from duration
  let finalEndTime = endTime;
  if (!finalEndTime && durationMs !== null && durationMs !== undefined) {
    finalEndTime = new Date(dayStart.getTime() + durationMs);
  }
  if (finalEndTime && !(finalEndTime instanceof Date)) {
    finalEndTime = new Date(finalEndTime);
  }

  // If both start_time and end_time are provided but duration_ms is not, calculate it
  let finalDurationMs = durationMs;
  if (
    dayStart &&
    finalEndTime &&
    (finalDurationMs === null || finalDurationMs === undefined)
  ) {
    finalDurationMs = finalEndTime.getTime() - dayStart.getTime();
    if (finalDurationMs < 0) {
      finalDurationMs = null;
    }
  }

  // Resolve project and determine hourly rate
  const { supabaseProjectId, firestoreProjectId, finalHourlyRate } =
    await resolveProjectAndRate(userName, project, hourlyRate);

  // Prepare entry data
  const entryData = {
    user_name: userName,
    start_time: dayStart.toISOString(),
    end_time: finalEndTime ? finalEndTime.toISOString() : null,
    duration_ms:
      finalDurationMs !== null && finalDurationMs !== undefined
        ? typeof finalDurationMs === "string"
          ? parseInt(finalDurationMs, 10)
          : finalDurationMs
        : null,
    hourly_rate:
      finalHourlyRate !== null && finalHourlyRate !== undefined
        ? typeof finalHourlyRate === "string"
          ? parseFloat(finalHourlyRate)
          : finalHourlyRate
        : null,
    project_id: supabaseProjectId,
    firestore_project_id: firestoreProjectId,
    billable: true, // Default to billable
    created_at: now.toISOString(),
    modified_at: now.toISOString(),
    creation_method: "manual",
    is_running: false,
  };

  return await insertEntryWithProjectInfo(entryData, userName);
}

/**
 * Starts a new time entry in Supabase
 * Creates a running entry with is_running = true
 * Handles project lookup (Firestore ID or Supabase UUID), rate determination, and shared project membership
 *
 * @param {string} userName - Username starting the entry
 * @param {number|null} hourlyRate - Optional hourly rate (will be overridden by project/member rate if available)
 * @param {string|null} project - Project identifier (Firestore ID or Supabase UUID)
 * @returns {Promise<Object>} Created time entry matching Firestore format
 */
export async function startEntry(userName, hourlyRate = null, project = null) {
  const now = new Date();

  // Resolve project and determine hourly rate
  const { supabaseProjectId, firestoreProjectId, finalHourlyRate } =
    await resolveProjectAndRate(userName, project, hourlyRate);

  // Prepare entry data
  const entryData = {
    user_name: userName,
    start_time: now.toISOString(),
    end_time: null,
    duration_ms: null,
    hourly_rate:
      finalHourlyRate !== null && finalHourlyRate !== undefined
        ? typeof finalHourlyRate === "string"
          ? parseFloat(finalHourlyRate)
          : finalHourlyRate
        : null,
    project_id: supabaseProjectId,
    firestore_project_id: firestoreProjectId,
    billable: true, // Default to billable
    created_at: now.toISOString(),
    modified_at: now.toISOString(),
    creation_method: "timer",
    is_running: true,
  };

  return await insertEntryWithProjectInfo(entryData, userName);
}

/**
 * Stops a running time entry in Supabase
 * Can stop a specific entry by ID or all active entries for a user
 * Replaces stopEntry() from Firestore
 *
 * @param {string} userName - Username stopping the entry
 * @param {string|null} entryId - Optional entry ID to stop. If null, stops all active entries
 * @returns {Promise<Object|Array|null>} Stopped entry/entries or null if none found
 */
export async function stopEntry(userName, entryId = null) {
  const endTime = new Date();

  if (entryId) {
    // Stop specific entry by ID
    // First, get the entry to verify it exists and is running
    const { data: entry, error: fetchError } = await supabaseServer
      .from("time_entries")
      .select("*")
      .eq("id", entryId)
      .eq("user_name", userName)
      .eq("is_running", true)
      .single();

    if (fetchError || !entry) {
      return null;
    }

    // Calculate duration_ms
    const startTime = new Date(entry.start_time);
    const durationMs = endTime.getTime() - startTime.getTime();

    // Update the entry
    const { data: updatedEntry, error: updateError } = await supabaseServer
      .from("time_entries")
      .update({
        end_time: endTime.toISOString(),
        is_running: false,
        duration_ms: durationMs > 0 ? durationMs : null,
        modified_at: endTime.toISOString(),
      })
      .eq("id", entryId)
      .select()
      .single();

    if (updateError) {
      console.error("Error stopping entry in Supabase:", updateError);
      throw updateError;
    }

    // Get project access info if project exists
    let projectName = null;
    let isProjectOwner = false;
    let isProjectMember = false;

    if (updatedEntry.project_id) {
      const { data: accessInfo } = await supabaseServer
        .rpc("get_project_access", {
          p_project_id: updatedEntry.project_id,
          p_user_name: userName,
        })
        .single();

      if (accessInfo) {
        projectName = accessInfo.project_name;
        isProjectOwner = accessInfo.is_project_owner;
        isProjectMember = accessInfo.is_project_member;
      }
    }

    // Return entry in the same format as getDayEntries
    return {
      id: updatedEntry.id,
      user_name: updatedEntry.user_name,
      start_time: updatedEntry.start_time,
      end_time: updatedEntry.end_time,
      duration_ms: updatedEntry.duration_ms ?? null,
      hourly_rate: updatedEntry.hourly_rate ?? null,
      project: updatedEntry.firestore_project_id ?? null,
      project_id: updatedEntry.project_id ?? null,
      project_name: projectName,
      billable: updatedEntry.billable ?? true,
      isProjectOwner: isProjectOwner,
      isProjectMember: isProjectMember,
      created_at: updatedEntry.created_at,
      modified_at: updatedEntry.modified_at,
      creation_method: updatedEntry.creation_method ?? null,
      is_running: updatedEntry.is_running ?? false,
      firestore_id: updatedEntry.firestore_id,
    };
  } else {
    // Stop all active entries for the user
    const { data: activeEntries, error: fetchError } = await supabaseServer
      .from("time_entries")
      .select("*")
      .eq("user_name", userName)
      .eq("is_running", true)
      .eq("creation_method", "timer");

    if (fetchError) {
      console.error("Error fetching active entries:", fetchError);
      throw fetchError;
    }

    if (!activeEntries || activeEntries.length === 0) {
      return null;
    }

    // Calculate duration_ms for each entry before updating
    const endTimeMs = endTime.getTime();

    // Update all entries with their calculated duration_ms
    // Note: Supabase doesn't support bulk updates with different values per row,
    // so we need to update them individually
    const stoppedEntries = await Promise.all(
      activeEntries.map(async (entry) => {
        const startTimeMs = new Date(entry.start_time).getTime();
        const durationMs = endTimeMs - startTimeMs;

        const { data: updatedEntry, error: updateError } = await supabaseServer
          .from("time_entries")
          .update({
            end_time: endTime.toISOString(),
            is_running: false,
            duration_ms: durationMs > 0 ? durationMs : null,
            modified_at: endTime.toISOString(),
          })
          .eq("id", entry.id)
          .select()
          .single();

        if (updateError) {
          console.error(`Error stopping entry ${entry.id}:`, updateError);
          throw updateError;
        }

        // Get project access info if project exists
        let projectName = null;
        let isProjectOwner = false;
        let isProjectMember = false;

        if (updatedEntry.project_id) {
          const { data: accessInfo } = await supabaseServer
            .rpc("get_project_access", {
              p_project_id: updatedEntry.project_id,
              p_user_name: userName,
            })
            .single();

          if (accessInfo) {
            projectName = accessInfo.project_name;
            isProjectOwner = accessInfo.is_project_owner;
            isProjectMember = accessInfo.is_project_member;
          }
        }

        return {
          id: updatedEntry.id,
          user_name: updatedEntry.user_name,
          start_time: updatedEntry.start_time,
          end_time: updatedEntry.end_time,
          duration_ms: updatedEntry.duration_ms ?? null,
          hourly_rate: updatedEntry.hourly_rate ?? null,
          project: updatedEntry.firestore_project_id ?? null,
          project_id: updatedEntry.project_id ?? null,
          project_name: projectName,
          billable: updatedEntry.billable ?? true,
          isProjectOwner: isProjectOwner,
          isProjectMember: isProjectMember,
          created_at: updatedEntry.created_at,
          modified_at: updatedEntry.modified_at,
          creation_method: updatedEntry.creation_method ?? null,
          is_running: updatedEntry.is_running ?? false,
          firestore_id: updatedEntry.firestore_id,
        };
      })
    );

    return stoppedEntries;
  }
}
