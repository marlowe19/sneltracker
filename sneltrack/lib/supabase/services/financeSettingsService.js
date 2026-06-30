/**
 * Finance Settings Service for Supabase
 * User forecast rates, tax reserve, and finance toggles
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  DEFAULT_FORECAST_HOURLY_RATE,
  DEFAULT_FORECAST_WEEKLY_HOURS,
  DEFAULT_TAX_RESERVE_PCT,
} from "@/lib/preferences/forecastSettings";

function mapRowToClient(row) {
  if (!row) return null;
  return {
    forecastHourlyRate:
      row.forecast_hourly_rate != null
        ? Number(row.forecast_hourly_rate)
        : DEFAULT_FORECAST_HOURLY_RATE,
    forecastWeeklyHours:
      row.forecast_weekly_hours != null
        ? Number(row.forecast_weekly_hours)
        : DEFAULT_FORECAST_WEEKLY_HOURS,
    taxReservePct:
      row.tax_reserve_pct != null
        ? Number(row.tax_reserve_pct)
        : DEFAULT_TAX_RESERVE_PCT,
    includeTeamEarnings: Boolean(row.include_team_earnings),
    includeProjectExpenses: Boolean(row.include_project_expenses),
    expenseCategoryReviewDismissed: Boolean(
      row.expense_category_review_dismissed,
    ),
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : null,
  };
}

export function validatePartial(updates) {
  const data = {};

  if (updates.forecastHourlyRate !== undefined) {
    const n = Number(updates.forecastHourlyRate);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("forecastHourlyRate must be a positive number");
    }
    data.forecast_hourly_rate = n;
  }

  if (updates.forecastWeeklyHours !== undefined) {
    const n = Number(updates.forecastWeeklyHours);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("forecastWeeklyHours must be a positive number");
    }
    data.forecast_weekly_hours = n;
  }

  if (updates.taxReservePct !== undefined) {
    const n = Number(updates.taxReservePct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error("taxReservePct must be between 0 and 100");
    }
    data.tax_reserve_pct = n;
  }

  if (updates.includeTeamEarnings !== undefined) {
    data.include_team_earnings = Boolean(updates.includeTeamEarnings);
  }

  if (updates.includeProjectExpenses !== undefined) {
    data.include_project_expenses = Boolean(updates.includeProjectExpenses);
  }

  if (updates.expenseCategoryReviewDismissed !== undefined) {
    data.expense_category_review_dismissed = Boolean(
      updates.expenseCategoryReviewDismissed,
    );
  }

  return data;
}

/**
 * @param {string} userName
 * @returns {Promise<object|null>}
 */
export async function get(userName) {
  const { data, error } = await supabaseServer
    .from("user_finance_settings")
    .select("*")
    .eq("user_name", userName)
    .maybeSingle();

  if (error) {
    console.error("Error fetching finance settings:", error);
    throw error;
  }

  return data ? mapRowToClient(data) : null;
}

/**
 * @param {string} userName
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function upsert(userName, updates) {
  const updateData = validatePartial(updates);
  if (Object.keys(updateData).length === 0) {
    throw new Error("No valid fields to update");
  }

  updateData.updated_at = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabaseServer
    .from("user_finance_settings")
    .select("user_name")
    .eq("user_name", userName)
    .maybeSingle();

  if (fetchError) {
    console.error("Error checking finance settings:", fetchError);
    throw fetchError;
  }

  if (existing) {
    const { data, error } = await supabaseServer
      .from("user_finance_settings")
      .update(updateData)
      .eq("user_name", userName)
      .select()
      .single();

    if (error) {
      console.error("Error updating finance settings:", error);
      throw error;
    }

    return mapRowToClient(data);
  }

  const { data, error } = await supabaseServer
    .from("user_finance_settings")
    .insert({
      user_name: userName,
      ...updateData,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating finance settings:", error);
    throw error;
  }

  return mapRowToClient(data);
}
