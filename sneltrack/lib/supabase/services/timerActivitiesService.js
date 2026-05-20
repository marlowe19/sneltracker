/**
 * Timer Activities Service for Supabase
 * Handles all timer activity operations
 */

import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Get all activities for a timer entry
 * @param {string} timeEntryId - Time entry UUID
 * @returns {Promise<Array>} Array of timer activities
 */
export async function getTimerActivities(timeEntryId) {
  if (!timeEntryId) {
    return [];
  }

  const { data, error } = await supabaseServer
    .from("timer_activities")
    .select("*")
    .eq("time_entry_id", timeEntryId)
    .order("display_order", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching timer activities:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get current active activity for a timer entry
 * @param {string} timeEntryId - Time entry UUID
 * @returns {Promise<Object|null>} Current active activity or null
 */
export async function getCurrentActivity(timeEntryId) {
  if (!timeEntryId) {
    return null;
  }

  const { data, error } = await supabaseServer
    .from("timer_activities")
    .select("*")
    .eq("time_entry_id", timeEntryId)
    .is("end_time", null)
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned - no active activity
      return null;
    }
    console.error("Error fetching current activity:", error);
    throw error;
  }

  return data;
}

/**
 * Start first activity when timer starts
 * @param {string} timeEntryId - Time entry UUID
 * @param {string} activityType - Activity type name
 * @param {number|null} hourlyRate - Hourly rate for this activity
 * @param {string|null} userId - User ID (UUID) who created this activity
 * @param {string|null} userActivityId - User activity UUID when started from user_activities (no project)
 * @returns {Promise<Object>} Created activity
 */
export async function startActivity(
  timeEntryId,
  activityType,
  hourlyRate,
  userId = null,
  userActivityId = null
) {
  if (!timeEntryId || !activityType) {
    throw new Error("Time entry ID and activity type are required");
  }

  const now = new Date().toISOString();

  // Get user_id from time_entry if not provided
  let finalUserId = userId;
  if (!finalUserId) {
    const { data: timeEntry } = await supabaseServer
      .from("time_entries")
      .select("user_id")
      .eq("id", timeEntryId)
      .single();

    if (timeEntry?.user_id) {
      finalUserId = timeEntry.user_id;
    }
  }

  // Get current activity count to set display_order
  const { count } = await supabaseServer
    .from("timer_activities")
    .select("*", { count: "exact", head: true })
    .eq("time_entry_id", timeEntryId);

  const insertData = {
    time_entry_id: timeEntryId,
    activity_type: activityType,
    hourly_rate: hourlyRate ?? null,
    start_time: now,
    end_time: null,
    duration_ms: null, // Will be calculated when activity ends
    billable: true,
    display_order: (count || 0),
    user_id: finalUserId,
    user_activity_id: userActivityId ?? null,
    created_at: now,
    modified_at: now,
  };

  const { data, error } = await supabaseServer
    .from("timer_activities")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error starting activity:", error);
    throw error;
  }

  // Update time entry to mark it has activities and set current activity
  await supabaseServer
    .from("time_entries")
    .update({
      has_activities: true,
      current_activity_id: data.id,
      modified_at: now,
    })
    .eq("id", timeEntryId);

  return data;
}

/**
 * Switch to a new activity (stop current, start new)
 * @param {string} timeEntryId - Time entry UUID
 * @param {string} activityType - New activity type name
 * @param {number|null} hourlyRate - Hourly rate for new activity
 * @param {string|null} userId - User ID (UUID) who created this activity
 * @returns {Promise<Object>} New activity
 */
export async function switchActivity(
  timeEntryId,
  activityType,
  hourlyRate,
  userId = null,
  userActivityId = null
) {
  if (!timeEntryId || !activityType) {
    throw new Error("Time entry ID and activity type are required");
  }

  const now = new Date().toISOString();

  // Get user_id from time_entry if not provided
  let finalUserId = userId;
  if (!finalUserId) {
    const { data: timeEntry } = await supabaseServer
      .from("time_entries")
      .select("user_id")
      .eq("id", timeEntryId)
      .single();

    if (timeEntry?.user_id) {
      finalUserId = timeEntry.user_id;
    }
  }

  // Stop current activity
  const currentActivity = await getCurrentActivity(timeEntryId);
  if (currentActivity) {
    const startTime = new Date(currentActivity.start_time);
    const endTime = new Date(now);
    const durationMs = endTime.getTime() - startTime.getTime();

    await supabaseServer
      .from("timer_activities")
      .update({
        end_time: now,
        duration_ms: durationMs,
        modified_at: now,
      })
      .eq("id", currentActivity.id);
  }

  // Start new activity
  const { count } = await supabaseServer
    .from("timer_activities")
    .select("*", { count: "exact", head: true })
    .eq("time_entry_id", timeEntryId);

  const insertData = {
    time_entry_id: timeEntryId,
    activity_type: activityType,
    hourly_rate: hourlyRate ?? null,
    start_time: now,
    end_time: null,
    duration_ms: null,
    billable: true,
    display_order: count || 0,
    user_id: finalUserId,
    user_activity_id: userActivityId ?? null,
    created_at: now,
    modified_at: now,
  };

  const { data, error } = await supabaseServer
    .from("timer_activities")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error switching activity:", error);
    throw error;
  }

  // Update time entry current activity and rate when switching
  await supabaseServer
    .from("time_entries")
    .update({
      has_activities: true,
      current_activity_id: data.id,
      hourly_rate: hourlyRate ?? null,
      modified_at: now,
    })
    .eq("id", timeEntryId);

  return data;
}

/**
 * Update a timer activity
 * @param {string} activityId - Activity UUID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated activity
 */
export async function updateTimerActivity(activityId, updates) {
  if (!activityId) {
    throw new Error("Activity ID is required");
  }

  const updateData = {
    modified_at: new Date().toISOString(),
  };

  if (updates.activity_type !== undefined) {
    updateData.activity_type = updates.activity_type;
  }
  if (updates.hourly_rate !== undefined) {
    updateData.hourly_rate = updates.hourly_rate;
  }
  if (updates.billable !== undefined) {
    updateData.billable = updates.billable;
  }
  if (updates.display_order !== undefined) {
    updateData.display_order = updates.display_order;
  }

  // If updating end_time, recalculate duration_ms
  if (updates.end_time !== undefined) {
    updateData.end_time = updates.end_time;
    
    // Get start_time to calculate duration
    const { data: activity } = await supabaseServer
      .from("timer_activities")
      .select("start_time")
      .eq("id", activityId)
      .single();

    if (activity && activity.start_time && updates.end_time) {
      const startTime = new Date(activity.start_time);
      const endTime = new Date(updates.end_time);
      updateData.duration_ms = endTime.getTime() - startTime.getTime();
    }
  }

  const { data, error } = await supabaseServer
    .from("timer_activities")
    .update(updateData)
    .eq("id", activityId)
    .select()
    .single();

  if (error) {
    console.error("Error updating timer activity:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a timer activity
 * @param {string} activityId - Activity UUID
 * @returns {Promise<void>}
 */
export async function deleteTimerActivity(activityId) {
  if (!activityId) {
    throw new Error("Activity ID is required");
  }

  const { error } = await supabaseServer
    .from("timer_activities")
    .delete()
    .eq("id", activityId);

  if (error) {
    console.error("Error deleting timer activity:", error);
    throw error;
  }
}

/**
 * Calculate total time and earnings for a timer
 * @param {string} timeEntryId - Time entry UUID
 * @returns {Promise<Object>} Object with totalDurationMs and totalEarnings
 */
export async function calculateTimerTotal(timeEntryId) {
  if (!timeEntryId) {
    return { totalDurationMs: 0, totalEarnings: 0 };
  }

  const activities = await getTimerActivities(timeEntryId);
  const currentActivity = await getCurrentActivity(timeEntryId);

  let totalDurationMs = 0;
  let totalEarnings = 0;

  for (const activity of activities) {
    let durationMs = activity.duration_ms;

    // If this is the current activity, calculate duration from start to now
    if (currentActivity && activity.id === currentActivity.id) {
      const startTime = new Date(activity.start_time);
      const now = new Date();
      durationMs = now.getTime() - startTime.getTime();
    }

    if (durationMs && durationMs > 0) {
      totalDurationMs += durationMs;
      
      if (activity.hourly_rate) {
        const hours = durationMs / (1000 * 60 * 60);
        totalEarnings += hours * parseFloat(activity.hourly_rate);
      }
    }
  }

  return {
    totalDurationMs,
    totalEarnings,
  };
}

