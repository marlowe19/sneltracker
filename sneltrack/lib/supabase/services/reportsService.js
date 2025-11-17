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
  const { data, error } = await supabaseServer.rpc('get_user_project_reports', {
    p_user_name: userName,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) {
    console.error('Error fetching project reports:', error);
    throw error;
  }

  // Transform the SQL result to match the expected format
  return data.map(row => ({
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
      totalMoney: (row.billable_duration_ms / (1000 * 60 * 60)) * 
        (row.is_owner ? (row.member_hourly_rate || row.project_hourly_rate || 0) : (row.member_hourly_rate || 0)),
    },
    billableHours: row.billable_duration_ms / (1000 * 60 * 60),
    unbillableHours: row.unbillable_duration_ms / (1000 * 60 * 60),
    // Determine hourly rate for billing
    hourlyRate: row.is_shared 
      ? (row.is_owner 
          ? (row.member_hourly_rate || row.project_hourly_rate) 
          : (row.member_hourly_rate || 0))
      : row.project_hourly_rate,
    totalExpenses: Number(row.total_expenses),
    // Include member breakdowns (empty array for non-owner or non-shared projects)
    members: Array.isArray(row.members) ? row.members : [],
  }));
}

