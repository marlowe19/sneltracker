/**
 * Time Entries Service for Supabase
 * Handles all time entry operations with fire-and-forget pattern
 * Designed to support gradual migration from Firestore
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { fireAndForget, logError, toIsoString } from "./base";

/**
 * Maps a Firestore time entry to Supabase schema
 *
 * @param {Object} entry - Firestore entry object
 * @returns {Object} Supabase entry object
 */
export function mapEntryToSupabase(entry) {
  return {
    firestore_id: entry.id,
    user_name: entry.user_name,
    start_time: toIsoString(entry.start_time),
    end_time: toIsoString(entry.end_time),
    duration_ms: entry.duration_ms ?? null,
    hourly_rate: entry.hourly_rate ?? null,
    project_id: null,
    firestore_project_id: entry.project,
    created_at: toIsoString(entry.created_at) || new Date().toISOString(),
    modified_at: toIsoString(entry.modified_at) || new Date().toISOString(),
    creation_method: entry.creation_method ?? null,
    is_running: entry.is_running ?? false,
  };
}

/**
 * Creates a time entry in Supabase (fire-and-forget)
 *
 * @param {Object} entry - Firestore entry object
 */
export function create(entry) {
  fireAndForget(
    async () => {
      const supabaseData = mapEntryToSupabase(entry);
      const { error } = await supabaseServer
        .from("time_entries")
        .insert(supabaseData);

      if (error) {
        throw error;
      }
    },
    "time_entry",
    "create",
    entry.id
  );
}

/**
 * Updates a time entry in Supabase (fire-and-forget)
 *
 * @param {Object} entry - Firestore entry object with updated data
 */
export function update(entry) {
  fireAndForget(
    async () => {
      const supabaseData = mapEntryToSupabase(entry);
      // Remove firestore_id from update data (it's the identifier, not updatable)
      const { firestore_id, ...updateData } = supabaseData;
      // Update modified_at to current time
      updateData.modified_at = new Date().toISOString();

      const { error } = await supabaseServer
        .from("time_entries")
        .update(updateData)
        .eq("firestore_id", entry.id);

      if (error) {
        throw error;
      }
    },
    "time_entry",
    "update",
    entry.id
  );
}

/**
 * Upserts a time entry in Supabase using firestore_id (fire-and-forget)
 * Useful for handling retries and ensuring idempotency
 *
 * @param {Object} entry - Firestore entry object
 */
export function upsert(entry) {
  fireAndForget(
    async () => {
      const supabaseData = mapEntryToSupabase(entry);
      // Update modified_at to current time for upsert
      supabaseData.modified_at = new Date().toISOString();

      const { error } = await supabaseServer
        .from("time_entries")
        .upsert(supabaseData, {
          onConflict: "firestore_id",
        });

      if (error) {
        throw error;
      }
    },
    "time_entry",
    "upsert",
    entry.id
  );
}
