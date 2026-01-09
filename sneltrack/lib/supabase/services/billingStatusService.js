/**
 * Billing Status Service for Supabase
 * Handles bulk status updates for time entries and expenses
 */

import { supabaseServer } from "@/lib/supabaseServer";

const VALID_STATUSES = ["draft", "pending", "billed", "paid"];

/**
 * Validate billing status value
 *
 * @param {string} status - Status to validate
 * @throws {Error} If status is invalid
 */
function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(
      `Invalid billing status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }
}

/**
 * Bulk update billing status for time entries
 *
 * @param {string} userName - Username (for authorization)
 * @param {Array<string>} entryIds - Array of time entry UUIDs
 * @param {string} status - New billing status
 * @returns {Promise<{ updated: number }>} Number of updated entries
 */
export async function bulkUpdateTimeEntryStatus(userName, entryIds, status) {
  validateStatus(status);

  if (!entryIds || entryIds.length === 0) {
    return { updated: 0 };
  }

  // First verify all entries belong to the user or are in projects the user owns
  // We'll use a query that checks user_name OR project ownership
  const { data: entries, error: fetchError } = await supabaseServer
    .from("time_entries")
    .select("id, user_name, project_id, projects!inner(owner_name)")
    .in("id", entryIds);

  if (fetchError) {
    console.error("Error fetching time entries for bulk update:", fetchError);
    throw fetchError;
  }

  // Filter to only entries the user can update
  const authorizedIds = entries
    .filter((entry) => {
      // User can update their own entries
      if (entry.user_name === userName) return true;
      // User can update entries in projects they own
      if (entry.projects?.owner_name === userName) return true;
      return false;
    })
    .map((entry) => entry.id);

  if (authorizedIds.length === 0) {
    return { updated: 0 };
  }

  // Update only authorized entries
  const { data, error } = await supabaseServer
    .from("time_entries")
    .update({ billing_status: status, modified_at: new Date().toISOString() })
    .in("id", authorizedIds)
    .select("id");

  if (error) {
    console.error("Error bulk updating time entry status:", error);
    throw error;
  }

  return { updated: data?.length || 0 };
}

/**
 * Bulk update billing status for expenses
 *
 * @param {string} userName - Username (for authorization)
 * @param {Array<string>} expenseIds - Array of expense UUIDs
 * @param {string} status - New billing status
 * @returns {Promise<{ updated: number }>} Number of updated expenses
 */
export async function bulkUpdateExpenseStatus(userName, expenseIds, status) {
  validateStatus(status);

  if (!expenseIds || expenseIds.length === 0) {
    return { updated: 0 };
  }

  // First verify all expenses belong to the user or are in projects the user owns
  const { data: expenses, error: fetchError } = await supabaseServer
    .from("expenses")
    .select("id, user_name, project_id, projects!inner(owner_name)")
    .in("id", expenseIds);

  if (fetchError) {
    console.error("Error fetching expenses for bulk update:", fetchError);
    throw fetchError;
  }

  // Filter to only expenses the user can update
  const authorizedIds = expenses
    .filter((expense) => {
      // User can update their own expenses
      if (expense.user_name === userName) return true;
      // User can update expenses in projects they own
      if (expense.projects?.owner_name === userName) return true;
      return false;
    })
    .map((expense) => expense.id);

  if (authorizedIds.length === 0) {
    return { updated: 0 };
  }

  // Update only authorized expenses
  const { data, error } = await supabaseServer
    .from("expenses")
    .update({ billing_status: status, modified_at: new Date().toISOString() })
    .in("id", authorizedIds)
    .select("id");

  if (error) {
    console.error("Error bulk updating expense status:", error);
    throw error;
  }

  return { updated: data?.length || 0 };
}


