/**
 * Stored Reports Service for Supabase
 * Handles CRUD operations for stored report snapshots
 */

import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Save a new stored report snapshot
 *
 * @param {string} userName - Username creating the report
 * @param {string} name - Report name
 * @param {string} description - Optional report description
 * @param {Object} reportData - Report data object containing projects, totals, and filters
 * @returns {Promise<Object>} Created stored report
 */
export async function saveStoredReport(userName, name, description, reportData) {
  const { data, error } = await supabaseServer
    .from("stored_reports")
    .insert({
      user_name: userName,
      name: name.trim(),
      description: description ? description.trim() : null,
      report_data: reportData,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving stored report:", error);
    throw error;
  }

  return data;
}

/**
 * Get all stored reports for a user
 *
 * @param {string} userName - Username to get reports for
 * @returns {Promise<Array>} Array of stored reports with metadata
 */
export async function getStoredReports(userName) {
  const { data, error } = await supabaseServer
    .from("stored_reports")
    .select("id, name, description, created_at, updated_at")
    .eq("user_name", userName)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching stored reports:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get a specific stored report by ID
 *
 * @param {string} userName - Username (for security check)
 * @param {string} reportId - Report UUID
 * @returns {Promise<Object>} Full stored report with report_data
 */
export async function getStoredReport(userName, reportId) {
  const { data, error } = await supabaseServer
    .from("stored_reports")
    .select("*")
    .eq("id", reportId)
    .eq("user_name", userName)
    .single();

  if (error) {
    console.error("Error fetching stored report:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a stored report
 *
 * @param {string} userName - Username (for security check)
 * @param {string} reportId - Report UUID to delete
 * @returns {Promise<void>}
 */
export async function deleteStoredReport(userName, reportId) {
  const { error } = await supabaseServer
    .from("stored_reports")
    .delete()
    .eq("id", reportId)
    .eq("user_name", userName);

  if (error) {
    console.error("Error deleting stored report:", error);
    throw error;
  }
}

