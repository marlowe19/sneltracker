/**
 * Reports Service for Supabase
 * Handles report generation using efficient SQL functions
 */

import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Get project reports for a user within a date range
 * Uses PostgreSQL function for efficient aggregation
 * Includes member breakdowns for shared projects where user is owner
 *
 * @param {string} userName - Username to get reports for
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Promise<Array>} Array of project reports with statistics and member breakdowns
 */
export async function getUserProjectReports(userName, startDate, endDate) {
  const { data, error } = await supabaseServer.rpc(
    "get_user_project_reports_v5", // v5: activity-aware billable/unbillable splits
    {
      p_user_name: userName,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    }
  );

  if (error) {
    console.error("Error fetching project reports:", error);
    throw error;
  }

  // Transform the SQL result to match the expected format
  return data.map((row) => ({
    id: row.project_id,
    name: row.project_name,
    hourly_rate: row.project_hourly_rate,
    member_hourly_rate: row.member_hourly_rate,
    is_shared: row.is_shared,
    owner: row.owner_name,
    is_default: row.is_default,
    is_owner: row.is_owner,
    statistics: {
      totalHours: row.total_duration_ms / (1000 * 60 * 60), // Convert ms to hours
      entryCount: Number(row.entry_count),
      // Calculate total money based on billable hours and rate
      totalMoney:
        (row.billable_duration_ms / (1000 * 60 * 60)) *
        (row.is_owner
          ? row.member_hourly_rate || row.project_hourly_rate || 0
          : row.member_hourly_rate || 0),
    },
    billableHours: row.billable_duration_ms / (1000 * 60 * 60),
    unbillableHours: row.unbillable_duration_ms / (1000 * 60 * 60),
    // Determine hourly rate for billing
    hourlyRate: row.is_shared
      ? row.is_owner
        ? row.member_hourly_rate || row.project_hourly_rate
        : row.member_hourly_rate || 0
      : row.project_hourly_rate,
    totalExpenses: Number(row.total_expenses),
    // Include member breakdowns (empty array for non-owner or non-shared projects)
    // Members now include user_display_name from v3
    members: Array.isArray(row.members) ? row.members : [],
  }));
}

/**
 * Get overall activities breakdown for a user within a date range
 * Aggregates activities by activity_type across all projects
 *
 * @param {string} userName - Username to get activities for
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @param {Array<string>|null} projectIds - Optional array of project UUIDs to filter by
 * @returns {Promise<Array>} Array of activities with activity_type, total_hours, and count
 */
export async function getActivitiesReport(
  userName,
  startDate,
  endDate,
  projectIds = null
) {
  const { data, error } = await supabaseServer.rpc("get_activities_report", {
    p_user_name: userName,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_project_ids: projectIds && projectIds.length > 0 ? projectIds : null,
  });

  if (error) {
    console.error("Error fetching activities report:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    activity_type: row.activity_type,
    total_hours: Number(row.total_hours) || 0,
    count: Number(row.count) || 0,
    hourly_rate: Number(row.hourly_rate) || 0,
    total_amount: Number(row.total_amount) || 0,
  }));
}

/**
 * Get per-project activities breakdown for a user within a date range
 * Aggregates activities by project_id and activity_type
 *
 * @param {string} userName - Username to get activities for
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @param {Array<string>|null} projectIds - Optional array of project UUIDs to filter by
 * @returns {Promise<Array>} Array of activities with project_id, activity_type, total_hours, and count
 */
export async function getProjectActivitiesReport(
  userName,
  startDate,
  endDate,
  projectIds = null
) {
  const { data, error } = await supabaseServer.rpc(
    "get_project_activities_report",
    {
      p_user_name: userName,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_project_ids: projectIds && projectIds.length > 0 ? projectIds : null,
    }
  );

  if (error) {
    console.error("Error fetching project activities report:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    project_id: row.project_id,
    activity_type: row.activity_type,
    total_hours: Number(row.total_hours) || 0,
    count: Number(row.count) || 0,
    hourly_rate: Number(row.hourly_rate) || 0,
    total_amount: Number(row.total_amount) || 0,
  }));
}
