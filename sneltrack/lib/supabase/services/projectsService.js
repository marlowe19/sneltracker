/**
 * Projects Service for Supabase
 * Handles all project operations including:
 * - Fire-and-forget writes for gradual migration from Firestore
 * - Read operations for projects listing and detail pages
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { fireAndForget, logError, toIsoString } from "./base";

/**
 * Looks up a user ID by username from the users table
 *
 * @param {string} username - Username to look up
 * @returns {Promise<string|null>} User UUID or null if not found
 */
export async function lookupUserIdByUsername(username) {
  if (!username) return null;

  const { data, error } = await supabaseServer
    .from("users")
    .select("id")
    .eq("user_name", username)
    .single();

  if (!error && data?.id) {
    return data.id;
  }

  return null;
}

export async function lookupUserByEmail(email) {
  if (!email) return null;
  const { data, error } = await supabaseServer
    .from("users")
    .select("id, name, user_name")
    .eq("email", email)
    .single();

  if (!error && data?.id) {
    return data;
  }

  return null;
}

export async function lookupUserByUsername(username) {
  if (!username) return null;

  const { data, error } = await supabaseServer
    .from("users")
    .select("id, name")
    .eq("user_name", username)
    .single();

  if (!error && data?.id) {
    return data;
  }

  return null;
}

/**
 * Sync user data from Auth0 to Supabase users table
 * Updates name, email, and other fields if available
 *
 * @param {string} userName - Auth0 user ID (user_name)
 * @param {Object} auth0User - Auth0 user object with name, email, nickname, etc.
 * @returns {Promise<Object|null>} Updated user data or null if not found
 */
export async function syncUserWithAuth0(userName, auth0User) {
  if (!userName || !auth0User) return null;

  const displayName =
    auth0User.name || auth0User.nickname || auth0User.email || null;
  const email = auth0User.email || null;

  // First, check if user exists
  const existingUser = await lookupUserByUsername(userName);

  if (!existingUser) {
    // User doesn't exist, create one
    const { data, error } = await supabaseServer
      .from("users")
      .insert({
        user_name: userName,
        name: displayName,
        email: email,
      })
      .select("id, name")
      .single();

    if (error) {
      console.error("Error creating user:", error);
      return null;
    }

    return data;
  }

  // User exists, update if name is missing or different
  if (!existingUser.name && displayName) {
    const { data, error } = await supabaseServer
      .from("users")
      .update({
        name: displayName,
        ...(email && { email: email }),
      })
      .eq("user_name", userName)
      .select("id, name")
      .single();

    if (error) {
      console.error("Error updating user:", error);
      return existingUser;
    }

    return data;
  }

  return existingUser;
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

// ==========================================
// READ OPERATIONS (for migrated pages)
// ==========================================

/**
 * Get all projects for a user with statistics (hours, progress, etc.)
 * Uses PostgreSQL function for efficient single-query retrieval
 * Replaces getAllProjects() from Firestore
 *
 * @param {string} userName - Username to get projects for
 * @returns {Promise<Array>} Array of projects with statistics
 */
export async function getUserProjectsWithStats(userName) {
  const { data, error } = await supabaseServer.rpc(
    "get_user_projects_with_stats_v2",
    {
      p_user_name: userName,
    }
  );

  if (error) {
    console.error("Error fetching user projects with stats:", error);
    throw error;
  }

  // Transform to match expected format
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    hourly_rate: row.hourly_rate,
    member_hourly_rate: row.member_hourly_rate,
    budget_hours: row.budget_hours,
    is_shared: row.is_shared,
    is_default: row.is_default,
    owner: row.owner_name,
    is_owner: row.is_owner,
    member_role: row.member_role || null, // User's role from project_members
    member_count: row.member_count,
    total_hours: row.total_hours,
    is_over_budget: row.is_over_budget,
  }));
}

/**
 * Get detailed project information including statistics and members
 * Uses PostgreSQL function for efficient single-query retrieval
 * Replaces multiple Firestore queries (getProjectById, isProjectOwner, getProjectMembers, etc.)
 *
 * @param {string} userName - Username accessing the project
 * @param {string} projectId - Project UUID
 * @param {Date} startDate - Optional start date for statistics
 * @param {Date} endDate - Optional end date for statistics
 * @returns {Promise<Object|null>} Project detail object or null if not found
 */
export async function getProjectDetail(
  userName,
  projectId,
  startDate = null,
  endDate = null
) {
  const { data, error } = await supabaseServer.rpc("get_project_detail_v4", {
    // ✅ Updated to v4 for user_display_name in both members and member_statistics
    p_user_name: userName,
    p_project_id: projectId,
    p_start_date: startDate ? startDate.toISOString() : null,
    p_end_date: endDate ? endDate.toISOString() : null,
  });

  if (error) {
    console.error("Error fetching project detail:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    throw error;
  }

  // Function returns single row or empty array
  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];

  // Fetch additional fields directly from projects table since function doesn't return them yet
  const { data: projectData, error: projectError } = await supabaseServer
    .from("projects")
    .select(
      "due_date, start_date, end_date, capacity_per_week, priority, zip_code, budget_amount, currency, status"
    )
    .eq("id", projectId)
    .single();

  if (projectError) {
    console.error("Error fetching project fields:", projectError);
    // Continue without these fields rather than failing
  }

  return {
    id: row.id,
    name: row.name,
    hourly_rate: row.hourly_rate,
    member_hourly_rate: row.member_hourly_rate,
    budget_hours: row.budget_hours,
    is_shared: row.is_shared,
    is_default: row.is_default,
    owner: row.owner_name,
    is_owner: row.is_owner,
    due_date: projectData?.due_date || null,
    start_date: projectData?.start_date || null,
    end_date: projectData?.end_date || null,
    budget_amount: projectData?.budget_amount || null,
    currency: projectData?.currency || "EUR",
    capacity_per_week: projectData?.capacity_per_week || null,
    priority: projectData?.priority || null,
    zip_code: projectData?.zip_code || null,
    status: projectData?.status || "active",
    statistics: {
      totalHours: row.total_hours,
      entryCount: Number(row.entry_count),
      totalMoney: row.total_billable,
    },
    members: row.members || [],
    memberStatistics: row.member_statistics || [],
  };
}

// ==========================================
// WRITE OPERATIONS (for API routes)
// ==========================================

/**
 * Creates a new project in Supabase
 *
 * @param {string} userName - Username creating the project
 * @param {Object} projectData - Project data object
 * @param {string} projectData.name - Project name (required)
 * @param {number|null} projectData.hourly_rate - Hourly rate
 * @param {number|null} projectData.budget_hours - Budget hours (time budget)
 * @param {number|null} [projectData.budget_amount] - Budget amount for expenses (matches projects.budget_amount)
 * @param {boolean} projectData.is_shared - Whether project is shared
 * @param {boolean} projectData.is_default - Whether project is default
 * @param {string|null} projectData.due_date - Deadline date (ISO date string or null)
 * @param {string|null} projectData.start_date - Project start date (ISO date string or null)
 * @param {string|null} [projectData.end_date] - Planned project end date (ISO date string or null)
 * @param {string|null} [projectData.currency] - Currency code (ISO 4217, e.g. EUR)
 * @returns {Promise<Object>} Created project object
 */
export async function createProject(userName, projectData) {
  // Look up owner_id from username
  const ownerId = await lookupUserIdByUsername(userName);
  if (!ownerId) {
    throw new Error(
      `Cannot create project: owner_id not found for username "${userName}"`
    );
  }

  // Prepare project data for insertion
  const insertData = {
    name: projectData.name.trim(),
    owner_id: ownerId,
    owner_name: userName,
    hourly_rate: projectData.hourly_rate ?? null,
    budget_hours: projectData.budget_hours ?? null,
    budget_amount: projectData.budget_amount ?? null,
    is_shared: projectData.is_shared ?? false,
    is_default: projectData.is_default ?? false,
    due_date: projectData.due_date || null,
    start_date: projectData.start_date || null,
    end_date: projectData.end_date || null,
    currency: projectData.currency || "EUR",
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("projects")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating project in Supabase:", error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    hourly_rate: data.hourly_rate,
    budget_hours: data.budget_hours,
    is_shared: data.is_shared,
    is_default: data.is_default,
    due_date: data.due_date,
    start_date: data.start_date,
    owner: data.owner_name,
  };
}

/**
 * Updates a project in Supabase
 * Validates user has permission (owner for shared projects)
 *
 * @param {string} userName - Username updating the project
 * @param {string} projectId - Project UUID
 * @param {Object} updates - Update data object
 * @param {string} [updates.name] - Project name
 * @param {number|null} [updates.hourly_rate] - Hourly rate
 * @param {number|null} [updates.budget_hours] - Budget hours
 * @param {number|null} [updates.budget_amount] - Budget amount for expenses
 * @param {number|null} [updates.capacity_per_week] - Capacity per week in hours
 * @param {number|null} [updates.priority] - Priority level (1-5, 5=highest)
 * @param {string|null} [updates.zip_code] - Dutch postal code (1234AB format)
 * @param {boolean} [updates.is_default] - Whether project is default
 * @param {string|null} [updates.due_date] - Deadline date (ISO date string or null)
 * @param {string|null} [updates.start_date] - Project start date (ISO date string or null)
 * @param {string|null} [updates.end_date] - Planned project end date (ISO date string or null)
 * @param {string|null} [updates.actual_end_date] - Actual end date when project was completed/archived (ISO date string or null)
 * @param {string|null} [updates.description] - Project description/notes
 * @param {string|null} [updates.currency] - Currency code (ISO 4217)
 * @param {string} [updates.status] - Project status (planned, active, on_hold, completed, cancelled, archived)
 * @returns {Promise<Object>} Updated project object
 */
export async function updateProject(userName, projectId, updates) {
  // First check if project exists and user has permission
  const projectDetail = await getProjectDetail(userName, projectId);
  if (!projectDetail) {
    throw new Error("Project not found");
  }

  // For shared projects, only owner can update most fields
  // Exception: priority and zip_code can be updated by all users
  if (projectDetail.is_shared && !projectDetail.is_owner) {
    const allowedFieldsForMembers = ["priority", "zip_code"];
    const updateKeys = Object.keys(updates).filter(
      (key) => updates[key] !== undefined
    );
    const hasRestrictedFields = updateKeys.some(
      (key) => !allowedFieldsForMembers.includes(key)
    );

    if (hasRestrictedFields) {
      throw new Error("Only project owners can update shared projects");
    }
  }

  // Only user projects can update is_default
  if (updates.is_default !== undefined && projectDetail.is_shared) {
    throw new Error("Only user projects can update is_default");
  }

  // Prepare update data
  const updateData = {
    modified_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name.trim();
  }
  if (updates.hourly_rate !== undefined) {
    updateData.hourly_rate = updates.hourly_rate;
  }
  if (updates.budget_hours !== undefined) {
    updateData.budget_hours = updates.budget_hours;
  }
  if (updates.budget_amount !== undefined) {
    updateData.budget_amount = updates.budget_amount;
  }
  if (updates.capacity_per_week !== undefined) {
    updateData.capacity_per_week = updates.capacity_per_week;
  }
  if (updates.priority !== undefined) {
    updateData.priority = updates.priority;
  }
  if (updates.zip_code !== undefined) {
    // Normalize zip code: uppercase and trim
    updateData.zip_code = updates.zip_code
      ? updates.zip_code.trim().toUpperCase()
      : null;
  }
  if (updates.is_default !== undefined) {
    updateData.is_default = updates.is_default;
  }
  if (updates.due_date !== undefined) {
    updateData.due_date = updates.due_date || null;
  }
  if (updates.start_date !== undefined) {
    updateData.start_date = updates.start_date || null;
  }
  if (updates.end_date !== undefined) {
    updateData.end_date = updates.end_date || null;
  }
  if (updates.actual_end_date !== undefined) {
    updateData.actual_end_date = updates.actual_end_date || null;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description || null;
  }
  if (updates.currency !== undefined) {
    updateData.currency = updates.currency || "EUR";
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status;
  }

  const { data, error } = await supabaseServer
    .from("projects")
    .update(updateData)
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    console.error("Error updating project in Supabase:", error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    hourly_rate: data.hourly_rate,
    budget_hours: data.budget_hours,
    is_shared: data.is_shared,
    is_default: data.is_default,
    due_date: data.due_date,
    start_date: data.start_date,
    capacity_per_week: data.capacity_per_week,
    priority: data.priority,
    zip_code: data.zip_code,
    status: data.status,
    owner: data.owner_name,
  };
}

// ==========================================
// PROJECT MEMBER OPERATIONS
// ==========================================

/**
 * Adds a member to a project in Supabase
 *
 * @param {string} projectId - Supabase project UUID
 * @param {string} userName - Username to add as member
 * @param {string} role - Member role (default: 'member')
 * @param {number|null} hourlyRate - Optional hourly rate for this member
 * @param {number|null} capacityPerWeek - Optional capacity per week for this member
 */
export async function addProjectMember(
  projectId,
  userName,
  role = "member",
  hourlyRate = null,
  capacityPerWeek = null
) {
  const memberData = {
    project_id: projectId,
    user_name: userName,
    role: role,
    hourly_rate: hourlyRate,
    capacity_per_week: capacityPerWeek,
    added_at: new Date().toISOString(),
  };

  const { error } = await supabaseServer
    .from("project_members")
    .upsert(memberData, {
      onConflict: "project_id,user_name",
    });

  if (error) {
    console.error("Error adding project member to Supabase:", error);
    throw error;
  }

  return true;
}

/**
 * Updates a project member's hourly rate in Supabase
 *
 * @param {string} projectId - Supabase project UUID
 * @param {string} userName - Username of member to update
 * @param {number|null} hourlyRate - New hourly rate
 */
export async function updateProjectMemberRate(
  projectId,
  userName,
  hourlyRate = null
) {
  const { error } = await supabaseServer
    .from("project_members")
    .update({ hourly_rate: hourlyRate })
    .eq("project_id", projectId)
    .eq("user_name", userName);

  if (error) {
    console.error("Error updating member rate in Supabase:", error);
    throw error;
  }

  return true;
}

/**
 * Updates a project member's capacity per week in Supabase
 *
 * @param {string} projectId - Supabase project UUID
 * @param {string} userName - Username of member to update
 * @param {number|null} capacityPerWeek - New capacity per week
 */
export async function updateProjectMemberCapacity(
  projectId,
  userName,
  capacityPerWeek = null
) {
  const { error } = await supabaseServer
    .from("project_members")
    .update({ capacity_per_week: capacityPerWeek })
    .eq("project_id", projectId)
    .eq("user_name", userName);

  if (error) {
    console.error("Error updating member capacity in Supabase:", error);
    throw error;
  }

  return true;
}

/**
 * Updates a project member's role in Supabase
 *
 * @param {string} projectId - Supabase project UUID
 * @param {string} userName - Username of member to update
 * @param {string} role - New role ("owner" or "member")
 */
export async function updateProjectMemberRole(projectId, userName, role) {
  const { error } = await supabaseServer
    .from("project_members")
    .update({ role: role })
    .eq("project_id", projectId)
    .eq("user_name", userName);

  if (error) {
    console.error("Error updating member role in Supabase:", error);
    throw error;
  }

  return true;
}

/**
 * Removes a member from a project in Supabase
 *
 * @param {string} projectId - Supabase project UUID
 * @param {string} userName - Username to remove
 */
export async function removeProjectMember(projectId, userName) {
  const { error } = await supabaseServer
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_name", userName);

  if (error) {
    console.error("Error removing member from Supabase:", error);
    throw error;
  }

  return true;
}

/**
 * Deletes a project from Supabase
 * Validates user has permission (must be owner)
 *
 * @param {string} userName - Username deleting the project
 * @param {string} projectId - Project UUID to delete
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteProject(userName, projectId) {
  // First check if project exists and user has permission
  const projectDetail = await getProjectDetail(userName, projectId);
  if (!projectDetail) {
    throw new Error("Project not found");
  }

  // Only project owner can delete
  if (!projectDetail.is_owner) {
    throw new Error("Only project owners can delete projects");
  }

  const { error } = await supabaseServer
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("Error deleting project from Supabase:", error);
    throw error;
  }

  return true;
}

/**
 * Get velocity metrics for a project (daily and weekly hours, trends, etc.)
 *
 * @param {string} userName - Username accessing the project
 * @param {string} projectId - Project UUID
 * @param {Date} startDate - Optional start date for velocity calculation
 * @param {Date} endDate - Optional end date for velocity calculation
 * @returns {Promise<Object|null>} Velocity metrics object or null if not found
 */
export async function getProjectVelocity(
  userName,
  projectId,
  startDate = null,
  endDate = null
) {
  const { data, error } = await supabaseServer.rpc("get_project_velocity", {
    p_user_name: userName,
    p_project_id: projectId,
    p_start_date: startDate ? startDate.toISOString() : null,
    p_end_date: endDate ? endDate.toISOString() : null,
  });

  if (error) {
    console.error("Error fetching project velocity:", error);
    throw error;
  }

  // Function returns single row or empty array
  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];

  return {
    dailyVelocity: row.daily_velocity || [],
    weeklyVelocity: row.weekly_velocity || [],
    averageDailyHours: row.average_daily_hours || 0,
    activeDays: row.active_days || 0,
    peakDayDate: row.peak_day_date,
    peakDayHours: row.peak_day_hours || 0,
    trendDirection: row.trend_direction || "insufficient_data",
    trendPercentage: row.trend_percentage || 0,
  };
}
