/**
 * Expenses Service for Supabase
 * Handles all expense operations with direct Supabase operations
 * Hard cutover from Firestore - no fire-and-forget pattern
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { formatDateForAPI } from "@/lib/dateRangeUtils";

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
 * @param {Object} row - Supabase expense row
 * @returns {Object} Expense in client format
 */
function mapExpenseToClient(row) {
  return {
    id: row.id, // Supabase UUID
    user_name: row.user_name,
    project: row.firestore_project_id ?? null, // Firestore project ID for client compatibility
    project_id: row.project_id ?? null, // Supabase project UUID
    name: row.name,
    price: row.price ?? null,
    includes_vat: row.includes_vat ?? false,
    expense_type: row.expense_type ?? "materials",
    date: row.date ? new Date(row.date).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    modified_at: row.modified_at
      ? new Date(row.modified_at).toISOString()
      : null,
  };
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
  const date = dayDate.toISOString();
  const expenseData = {
    user_name: userName,
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
  // Build YYYY-MM-DD in *local* time so it matches what you expect as "that day"
  const year = dayDate.getFullYear();
  const month = String(dayDate.getMonth() + 1).padStart(2, "0");
  const day = String(dayDate.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  const { data, error } = await supabaseServer
    .from("expenses")
    .select("*")
    .eq("user_name", userName)
    .eq("date", dateString) // DATE column, so equality on YYYY-MM-DD is enough
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching day expenses:", error);
    throw error;
  }

  // Map results
  return (data || []).map(mapExpenseToClient);
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
  // Parse ISO strings to Date objects for querying
  const weekStartDate = formatDateForAPI(weekStart);
  const weekEndDate = formatDateForAPI(weekEnd);

  const { data, error } = await supabaseServer
    .from("expenses")
    .select("*")
    .eq("user_name", userName)
    .gte("date", weekStartDate)
    .lte("date", weekEndDate)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching week expenses:", error);
    throw error;
  }

  // Map results
  return (data || []).map(mapExpenseToClient);
}

/**
 * Gets aggregated expense summary for a project
 * Returns total expenses and count of expense entries
 *
 * @param {string} projectId - Supabase project UUID
 * @returns {Promise<{ totalExpenses: number, expenseCount: number }>}
 */
export async function getProjectExpensesSummary(projectId) {
  if (!projectId) {
    throw new Error("projectId is required to get expenses summary");
  }

  const { data, error } = await supabaseServer
    .from("expenses")
    .select("price")
    .eq("project_id", projectId);

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
