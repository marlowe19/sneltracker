/**
 * Fixed Expenses Service for Supabase
 * Handles user recurring/fixed expenses (rent, road tax, etc.)
 */

import { supabaseServer } from "@/lib/supabaseServer";

function mapRowToClient(row) {
  return {
    id: row.id,
    user_name: row.user_name,
    name: row.name,
    price: row.price != null ? Number(row.price) : null,
    period: row.period,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    modified_at: row.modified_at
      ? new Date(row.modified_at).toISOString()
      : null,
  };
}

/**
 * Get all fixed expenses for a user
 * @param {string} userName - Auth0 user sub
 * @returns {Promise<Array>} Fixed expenses
 */
export async function getAll(userName) {
  const { data, error } = await supabaseServer
    .from("fixed_expenses")
    .select("*")
    .eq("user_name", userName)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching fixed expenses:", error);
    throw error;
  }

  return (data || []).map(mapRowToClient);
}

/**
 * Create a fixed expense
 * @param {string} userName - Auth0 user sub
 * @param {string} name - Expense name
 * @param {number} price - Amount
 * @param {string} period - 'month' | 'quarter' | 'year'
 * @returns {Promise<Object>} Created expense
 */
export async function create(userName, name, price, period) {
  const validPeriods = ["month", "quarter", "year"];
  if (!validPeriods.includes(period)) {
    throw new Error(`Invalid period: ${period}`);
  }

  const { data, error } = await supabaseServer
    .from("fixed_expenses")
    .insert({
      user_name: userName,
      name: name.trim(),
      price: typeof price === "string" ? parseFloat(price) : price,
      period,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating fixed expense:", error);
    throw error;
  }

  return mapRowToClient(data);
}

/**
 * Update a fixed expense
 * @param {string} userName - Auth0 user sub (for auth check)
 * @param {string} id - Expense UUID
 * @param {Object} updates - { name?, price?, period? }
 * @returns {Promise<Object>} Updated expense
 */
export async function update(userName, id, updates) {
  const { data: existing, error: fetchError } = await supabaseServer
    .from("fixed_expenses")
    .select("user_name")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Fixed expense ${id} not found`);
  }

  if (existing.user_name !== userName) {
    throw new Error("Unauthorized: Fixed expense does not belong to user");
  }

  const updateData = {};
  if (updates.name !== undefined) updateData.name = updates.name.trim();
  if (updates.price !== undefined) {
    updateData.price =
      typeof updates.price === "string"
        ? parseFloat(updates.price)
        : updates.price;
  }
  if (updates.period !== undefined) {
    const validPeriods = ["month", "quarter", "year"];
    if (!validPeriods.includes(updates.period)) {
      throw new Error(`Invalid period: ${updates.period}`);
    }
    updateData.period = updates.period;
  }

  const { data, error } = await supabaseServer
    .from("fixed_expenses")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating fixed expense:", error);
    throw error;
  }

  return mapRowToClient(data);
}

/**
 * Delete a fixed expense
 * @param {string} userName - Auth0 user sub (for auth check)
 * @param {string} id - Expense UUID
 */
export async function remove(userName, id) {
  const { data: existing, error: fetchError } = await supabaseServer
    .from("fixed_expenses")
    .select("user_name")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Fixed expense ${id} not found`);
  }

  if (existing.user_name !== userName) {
    throw new Error("Unauthorized: Fixed expense does not belong to user");
  }

  const { error } = await supabaseServer
    .from("fixed_expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting fixed expense:", error);
    throw error;
  }
}
