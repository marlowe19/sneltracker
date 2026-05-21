/**
 * Expenses Service for Supabase
 * Handles all expense operations with direct Supabase operations
 * Hard cutover from Firestore - no fire-and-forget pattern
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  formatDateForAPI,
  getWeekBoundsUTC,
  getMonthBoundsUTC,
  getQuarterBoundsUTC,
} from "@/lib/dateRangeUtils";
import { lookupUserIdByUsername } from "./projectsService";

/**
 * Looks up a Supabase project UUID by Firestore project ID
 *
 * @param {string} firestoreProjectId - Firestore project ID
 * @returns {Promise<string|null>} Project UUID or null if not found
 */
async function lookupProjectId(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabaseServer
    .from("projects")
    .select("id, firestore_id")
    .eq("id", projectId)
    .single();

  if (error || !data) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return data.id;
}

/**
 * Maps expense data from Supabase row to client format
 * Returns both project_id (UUID) and project (Firestore ID) for compatibility
 *
 * @param {Object} row - Supabase expense row (may include joined users data)
 * @returns {Object} Expense in client format
 */
function mapExpenseToClient(row) {
  return {
    id: row.id, // Supabase UUID
    user_name: row.user_name,
    user_display_name:
      row.user_display_name ?? row.users?.name ?? null,
    project: row.firestore_project_id ?? null, // Firestore project ID for client compatibility
    project_id: row.project_id ?? null, // Supabase project UUID
    project_name: row.project_name ?? row.projects?.name ?? null,
    name: row.name,
    price: row.price ?? null,
    includes_vat: row.includes_vat ?? false,
    expense_type: row.expense_type ?? "materials",
    date: row.date ? new Date(row.date).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    modified_at: row.modified_at
      ? new Date(row.modified_at).toISOString()
      : null,
    billing_status: row.billing_status ?? "draft",
  };
}

/**
 * Shared projects where the user is creator or has role 'owner' in project_members.
 * @param {string} userName
 * @returns {Promise<string[]>}
 */
async function getOwnerLevelSharedProjectIds(userName) {
  const ids = new Set();

  const { data: creatorProjects, error: creatorError } = await supabaseServer
    .from("projects")
    .select("id")
    .eq("is_shared", true)
    .eq("owner_name", userName);

  if (creatorError) {
    console.error("Error fetching creator shared projects:", creatorError);
    throw creatorError;
  }

  for (const row of creatorProjects || []) {
    if (row.id) ids.add(row.id);
  }

  const { data: ownerMembers, error: memberError } = await supabaseServer
    .from("project_members")
    .select("project_id")
    .eq("user_name", userName)
    .eq("role", "owner");

  if (memberError) {
    console.error("Error fetching owner-role memberships:", memberError);
    throw memberError;
  }

  for (const row of ownerMembers || []) {
    if (row.project_id) ids.add(row.project_id);
  }

  return Array.from(ids);
}

const EXPENSE_SELECT_WITH_JOINS = `
  *,
  users!user_id(name),
  projects:project_id (
    id,
    name,
    owner_name,
    is_shared
  )
`;

/**
 * Own expenses plus team expenses on shared projects where user is creator or owner-role member.
 * @param {string} userName
 * @param {{ dateEq?: string, dateGte?: string, dateLte?: string }} dateFilter
 * @returns {Promise<Array>}
 */
async function fetchVisibleExpenses(userName, dateFilter) {
  const sharedProjectIds = await getOwnerLevelSharedProjectIds(userName);
  const rowsById = new Map();

  const applyDateFilter = (query) => {
    if (dateFilter.dateEq) {
      return query.eq("date", dateFilter.dateEq);
    }
    if (dateFilter.dateGte && dateFilter.dateLte) {
      return query
        .gte("date", dateFilter.dateGte)
        .lte("date", dateFilter.dateLte);
    }
    return query;
  };

  const { data: ownRows, error: ownError } = await applyDateFilter(
    supabaseServer
      .from("expenses")
      .select(EXPENSE_SELECT_WITH_JOINS)
      .eq("user_name", userName)
  ).order("date", { ascending: false });

  if (ownError) {
    console.error("Error fetching own expenses:", ownError);
    throw ownError;
  }

  for (const row of ownRows || []) {
    rowsById.set(row.id, row);
  }

  if (sharedProjectIds.length > 0) {
    const { data: teamRows, error: teamError } = await applyDateFilter(
      supabaseServer
        .from("expenses")
        .select(EXPENSE_SELECT_WITH_JOINS)
        .in("project_id", sharedProjectIds)
    ).order("date", { ascending: false });

    if (teamError) {
      console.error("Error fetching team expenses:", teamError);
      throw teamError;
    }

    for (const row of teamRows || []) {
      rowsById.set(row.id, row);
    }
  }

  return Array.from(rowsById.values()).map((row) => mapExpenseToClient(row));
}

/**
 * Creates an expense in Supabase
 *
 * @param {string} userName - Username
 * @param {Date} dayDate - Date for the expense
 * @param {string} project - Firestore project ID (will be mapped to Supabase UUID)
 * @param {string} name - Expense name
 * @param {number} price - Expense price
 * @param {boolean} includesVat - Whether price includes VAT
 * @param {string} expenseType - Type of expense (default: "materials")
 * @returns {Promise<Object>} Created expense
 */
export async function create(
  userName,
  dayDate,
  project,
  name,
  price,
  includesVat = false,
  expenseType = "materials"
) {
  // Lookup Supabase project UUID from Firestore project ID
  const projectId = await lookupProjectId(project);
  if (!projectId) {
    throw new Error(`Project not found: ${project}`);
  }

  // Look up user_id from user_name
  const userId = await lookupUserIdByUsername(userName);

  const date = dayDate.toISOString();
  const expenseData = {
    user_name: userName,
    user_id: userId,
    project_id: projectId,
    firestore_project_id: project, // Store Firestore ID for reference
    name: name.trim(),
    price: typeof price === "string" ? parseFloat(price) : price,
    includes_vat: includesVat,
    expense_type: expenseType,
    date: dayDate.toISOString(), // Supabase will handle TIMESTAMP WITHOUT TIME ZONE conversion
  };

  const { data, error } = await supabaseServer
    .from("expenses")
    .insert(expenseData)
    .select()
    .single();

  if (error) {
    console.error("Error creating expense in Supabase:", error);
    throw error;
  }

  return mapExpenseToClient(data);
}

/**
 * Gets expenses for a specific day
 *
 * @param {string} userName - Username
 * @param {Date} dayDate - Date object representing the day
 * @returns {Promise<Array>} Array of expenses
 */
export async function getDayExpenses(userName, dayDate) {
  const year = dayDate.getFullYear();
  const month = String(dayDate.getMonth() + 1).padStart(2, "0");
  const day = String(dayDate.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  return fetchVisibleExpenses(userName, { dateEq: dateString });
}

/**
 * Gets expenses for a week range
 *
 * @param {string} userName - Username
 * @param {string} weekStart - ISO string for week start
 * @param {string} weekEnd - ISO string for week end
 * @returns {Promise<Array>} Array of expenses
 */
export async function getWeekExpenses(userName, weekStart, weekEnd) {
  const weekStartDate = formatDateForAPI(weekStart);
  const weekEndDate = formatDateForAPI(weekEnd);

  return fetchVisibleExpenses(userName, {
    dateGte: weekStartDate,
    dateLte: weekEndDate,
  });
}

/**
 * Gets expenses between two calendar dates (inclusive), by user.
 *
 * @param {string} userName - Username
 * @param {string} fromDateStr - YYYY-MM-DD
 * @param {string} toDateStr - YYYY-MM-DD
 * @returns {Promise<Array>} Expenses in client format
 */
export async function getExpensesBetweenDates(userName, fromDateStr, toDateStr) {
  const { data, error } = await supabaseServer
    .from("expenses")
    .select("*, users!user_id(name)")
    .eq("user_name", userName)
    .gte("date", fromDateStr)
    .lte("date", toDateStr)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching expenses in date range:", error);
    throw error;
  }

  return (data || []).map(mapExpenseToClient);
}

/**
 * Get expenses matching stored report filters
 * Reconstructs the exact query that generated the report
 *
 * @param {string} userName - Username to get expenses for
 * @param {Object} filters - Report filters object
 * @returns {Promise<Array>} Array of expenses with billing_status
 */
export async function getExpensesByReportFilters(userName, filters) {
  if (!filters) {
    throw new Error("Filters are required");
  }

  let startDate;
  let endDate;
  if (filters.customStartDate && filters.customEndDate) {
    startDate = formatDateForAPI(filters.customStartDate);
    endDate = formatDateForAPI(filters.customEndDate);
  } else if (filters.rangeType && filters.referenceDate) {
    const refDate = new Date(filters.referenceDate);

    if (filters.rangeType === "week") {
      const bounds = getWeekBoundsUTC(refDate);
      startDate = formatDateForAPI(bounds.start);
      endDate = formatDateForAPI(bounds.end);
    } else if (filters.rangeType === "month") {
      const bounds = getMonthBoundsUTC(refDate);
      startDate = formatDateForAPI(bounds.start);
      endDate = formatDateForAPI(bounds.end);
    } else if (filters.rangeType === "quarter") {
      const bounds = getQuarterBoundsUTC(refDate);
      startDate = formatDateForAPI(bounds.start);
      endDate = formatDateForAPI(bounds.end);
    }
  }

  const applyFilters = (query) => {
    let q = query;
    if (startDate && endDate) {
      q = q.gte("date", startDate).lte("date", endDate);
    }
    if (
      filters.selectedProjectIds &&
      Array.isArray(filters.selectedProjectIds) &&
      filters.selectedProjectIds.length > 0
    ) {
      q = q.in("project_id", filters.selectedProjectIds);
    }
    return q.order("date", { ascending: false });
  };

  const sharedProjectIds = await getOwnerLevelSharedProjectIds(userName);
  const rowsById = new Map();

  const { data: ownRows, error: ownError } = await applyFilters(
    supabaseServer
      .from("expenses")
      .select(EXPENSE_SELECT_WITH_JOINS)
      .eq("user_name", userName)
  );

  if (ownError) {
    console.error("Error fetching own expenses by report filters:", ownError);
    throw ownError;
  }

  for (const row of ownRows || []) {
    rowsById.set(row.id, row);
  }

  if (sharedProjectIds.length > 0) {
    const { data: teamRows, error: teamError } = await applyFilters(
      supabaseServer
        .from("expenses")
        .select(EXPENSE_SELECT_WITH_JOINS)
        .in("project_id", sharedProjectIds)
    );

    if (teamError) {
      console.error(
        "Error fetching team expenses by report filters:",
        teamError
      );
      throw teamError;
    }

    for (const row of teamRows || []) {
      rowsById.set(row.id, row);
    }
  }

  return Array.from(rowsById.values()).map((row) => mapExpenseToClient(row));
}

/**
 * Get expenses for a specific project
 * Reuses query structure from getExpensesByReportFilters()
 * 
 * @param {string} userName - Username to get expenses for
 * @param {string} projectId - Project UUID
 * @param {boolean} isOwner - Whether the user is the project owner
 * @returns {Promise<Array>} Array of expenses with billing_status, project_name, and user_display_name
 */
export async function getExpensesByProjectId(userName, projectId, isOwner) {
  let query = supabaseServer
    .from("expenses")
    .select(
      `
      *,
      users!user_id(name),
      projects:project_id (
        id,
        name,
        owner_name,
        is_shared
      )
    `
    )
    .eq("project_id", projectId);

  // Conditional filtering: owners see all expenses, members see only their own
  if (!isOwner) {
    query = query.eq("user_name", userName);
  }

  query = query.order("date", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching expenses by project ID:", error);
    throw error;
  }

  // Map results to include billing_status and project_name
  return (data || []).map((row) => {
    const expense = mapExpenseToClient(row);
    const project = row.projects;
    return {
      ...expense,
      billing_status: row.billing_status ?? "draft",
      project_name: project?.name ?? null,
    };
  });
}

/**
 * Gets aggregated expense summary for a project
 * Returns total expenses and count of expense entries
 *
 * @param {string} projectId - Supabase project UUID
 * @returns {Promise<{ totalExpenses: number, expenseCount: number }>}
 */
export async function getProjectExpensesSummary(
  projectId,
  userName,
  isOwnerLevel = false
) {
  if (!projectId) {
    throw new Error("projectId is required to get expenses summary");
  }

  let query = supabaseServer
    .from("expenses")
    .select("price")
    .eq("project_id", projectId);

  if (!isOwnerLevel) {
    query = query.eq("user_name", userName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project expenses summary:", error);
    throw error;
  }

  const rows = data || [];
  const totalRaw = rows.reduce((sum, row) => {
    const price = row.price ?? 0;
    return sum + (typeof price === "string" ? parseFloat(price) : price);
  }, 0);

  const totalExpenses = Math.round((totalRaw + Number.EPSILON) * 100) / 100;

  return {
    totalExpenses,
    expenseCount: rows.length,
  };
}

/**
 * Updates an expense in Supabase
 *
 * @param {string} userName - Username (for authorization check)
 * @param {string} expenseId - Expense UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated expense
 */
export async function update(userName, expenseId, updates) {
  // First verify the expense exists and belongs to the user
  const { data: existingExpense, error: fetchError } = await supabaseServer
    .from("expenses")
    .select("user_name")
    .eq("id", expenseId)
    .single();

  if (fetchError || !existingExpense) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  if (existingExpense.user_name !== userName) {
    throw new Error("Unauthorized: Expense does not belong to user");
  }

  // Build update data
  const updateData = {};

  if (updates.name !== undefined) {
    updateData.name = updates.name.trim();
  }

  if (updates.price !== undefined) {
    updateData.price =
      updates.price === null || updates.price === ""
        ? null
        : typeof updates.price === "string"
        ? parseFloat(updates.price)
        : updates.price;
  }

  if (updates.includes_vat !== undefined) {
    updateData.includes_vat = Boolean(updates.includes_vat);
  }

  if (updates.expense_type !== undefined) {
    updateData.expense_type = updates.expense_type;
  }

  if (updates.project !== undefined) {
    // If project is being updated, lookup the new project UUID
    if (updates.project === "" || updates.project === null) {
      updateData.project_id = null;
      updateData.firestore_project_id = null;
    } else {
      const projectId = await lookupProjectId(updates.project);
      updateData.project_id = projectId;
      updateData.firestore_project_id = updates.project;
    }
  }

  if (updates.date !== undefined) {
    const date =
      updates.date instanceof Date ? updates.date : new Date(updates.date);
    date.setHours(0, 0, 0, 0);
    updateData.date = date.toISOString(); // Supabase will handle TIMESTAMP WITHOUT TIME ZONE conversion
  }

  // Update the expense
  const { data, error } = await supabaseServer
    .from("expenses")
    .update(updateData)
    .eq("id", expenseId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating expense in Supabase:", error);
    throw error;
  }

  return mapExpenseToClient(data);
}

/**
 * Deletes an expense from Supabase
 *
 * @param {string} userName - Username (for authorization check)
 * @param {string} expenseId - Expense UUID
 * @returns {Promise<void>}
 */
export async function deleteExpense(userName, expenseId) {
  // First verify the expense exists and belongs to the user
  const { data: existingExpense, error: fetchError } = await supabaseServer
    .from("expenses")
    .select("user_name")
    .eq("id", expenseId)
    .single();

  if (fetchError || !existingExpense) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  if (existingExpense.user_name !== userName) {
    throw new Error("Unauthorized: Expense does not belong to user");
  }

  // Delete the expense
  const { error } = await supabaseServer
    .from("expenses")
    .delete()
    .eq("id", expenseId);

  if (error) {
    console.error("Error deleting expense from Supabase:", error);
    throw error;
  }
}
