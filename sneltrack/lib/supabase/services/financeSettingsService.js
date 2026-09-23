/**
 * Finance Settings Service for Supabase
 * User forecast rates, tax reserve, and finance toggles
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { lookupUserIdByAuthIdentity } from "./projectsService";
import {
  DEFAULT_FORECAST_HOURLY_RATE,
  DEFAULT_FORECAST_WEEKLY_HOURS,
  DEFAULT_TAX_RESERVE_PCT,
} from "@/lib/preferences/forecastSettings";

function isMissingRelationOrColumn(error) {
  const code = error?.code;
  if (code === "PGRST204" || code === "PGRST205") return true;
  return /schema cache/i.test(String(error?.message || ""));
}

async function requireFinanceSettingsUserId(authIdentity) {
  const userId = await lookupUserIdByAuthIdentity(authIdentity);
  if (!userId) {
    throw new Error("User not found");
  }
  return userId;
}

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

async function selectExisting(authIdentity, userId) {
  const byName = await supabaseServer
    .from("user_finance_settings")
    .select("*")
    .eq("user_name", authIdentity)
    .maybeSingle();

  if (!byName.error) {
    return byName.data ?? null;
  }
  if (!isMissingRelationOrColumn(byName.error)) {
    throw byName.error;
  }

  const byId = await supabaseServer
    .from("user_finance_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (byId.error) {
    throw byId.error;
  }
  return byId.data ?? null;
}

/**
 * Live SnelTracker keys the row by users.id (uuid) and also stores
 * Auth0 session.user.sub on user_name. Older 055-only schemas use
 * user_name as the primary key.
 *
 * @param {string} authIdentity
 * @returns {Promise<object|null>}
 */
export async function get(authIdentity) {
  const userId = await lookupUserIdByAuthIdentity(authIdentity);
  if (!userId && !authIdentity) return null;

  try {
    const row = await selectExisting(authIdentity, userId);
    return row ? mapRowToClient(row) : null;
  } catch (error) {
    console.error("Error fetching finance settings:", error);
    throw error;
  }
}

/**
 * @param {string} authIdentity
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function upsert(authIdentity, updates) {
  const userId = await requireFinanceSettingsUserId(authIdentity);
  const updateData = validatePartial(updates);
  if (Object.keys(updateData).length === 0) {
    throw new Error("No valid fields to update");
  }

  updateData.updated_at = new Date().toISOString();
  updateData.user_name = authIdentity;

  let existing;
  try {
    existing = await selectExisting(authIdentity, userId);
  } catch (fetchError) {
    console.error("Error checking finance settings:", fetchError);
    throw fetchError;
  }

  if (existing) {
    let query = supabaseServer
      .from("user_finance_settings")
      .update(updateData);

    if (existing.user_id) {
      query = query.eq("user_id", existing.user_id);
    } else {
      query = query.eq("user_name", existing.user_name || authIdentity);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Error updating finance settings:", error);
      throw error;
    }

    return mapRowToClient(data);
  }

  const { data, error } = await supabaseServer
    .from("user_finance_settings")
    .insert({
      user_id: userId,
      ...updateData,
    })
    .select()
    .single();

  if (error) {
    // Older 055 schemas only have user_name as PK.
    if (isMissingRelationOrColumn(error)) {
      const { data: namedRow, error: namedError } = await supabaseServer
        .from("user_finance_settings")
        .insert({
          user_name: authIdentity,
          ...updateData,
        })
        .select()
        .single();

      if (namedError) {
        console.error("Error creating finance settings:", namedError);
        throw namedError;
      }
      return mapRowToClient(namedRow);
    }

    console.error("Error creating finance settings:", error);
    throw error;
  }

  return mapRowToClient(data);
}
