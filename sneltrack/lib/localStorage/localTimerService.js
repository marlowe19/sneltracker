/**
 * Local Timer Service
 * Manages time entries in localStorage for anonymous users
 * Supports up to 30 entries with FIFO eviction
 */

const STORAGE_KEY = "sneltrack_local_entries";
const MAX_ENTRIES = 30;

/**
 * Generate a unique ID for local entries
 * @returns {string} Unique local entry ID
 */
function generateLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all local entries from localStorage
 * @returns {Array} Array of local time entries
 */
export function getLocalEntries() {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error reading local entries:", error);
    return [];
  }
}

/**
 * Save entries to localStorage
 * @param {Array} entries - Array of entries to save
 */
function saveLocalEntries(entries) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Error saving local entries:", error);
  }
}

/**
 * Add a new local entry
 * Enforces 30 entry limit with FIFO eviction (removes oldest stopped entries first)
 * @param {Object} entryData - Entry data (start_time, end_time, is_running, duration_ms)
 * @returns {Object} The created entry with ID
 */
export function addLocalEntry(entryData) {
  const entries = getLocalEntries();
  const now = new Date().toISOString();

  const newEntry = {
    id: generateLocalId(),
    start_time: entryData.start_time || now,
    end_time: entryData.end_time || null,
    is_running: entryData.is_running ?? true,
    duration_ms: entryData.duration_ms || null,
    created_at: now,
  };

  // Add new entry
  entries.push(newEntry);

  // Enforce max entries limit - remove oldest stopped entries first
  while (entries.length > MAX_ENTRIES) {
    // Find oldest stopped entry
    const stoppedEntries = entries.filter((e) => !e.is_running);
    if (stoppedEntries.length > 0) {
      // Sort by created_at and remove oldest
      stoppedEntries.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      const oldestId = stoppedEntries[0].id;
      const idx = entries.findIndex((e) => e.id === oldestId);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
    } else {
      // No stopped entries, remove oldest entry overall
      entries.shift();
    }
  }

  saveLocalEntries(entries);
  return newEntry;
}

/**
 * Update a local entry
 * @param {string} id - Entry ID to update
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated entry or null if not found
 */
export function updateLocalEntry(id, updates) {
  const entries = getLocalEntries();
  const index = entries.findIndex((e) => e.id === id);

  if (index === -1) {
    return null;
  }

  entries[index] = {
    ...entries[index],
    ...updates,
  };

  saveLocalEntries(entries);
  return entries[index];
}

/**
 * Get the currently running entry (if any)
 * @returns {Object|null} Running entry or null
 */
export function getRunningEntry() {
  const entries = getLocalEntries();
  return entries.find((e) => e.is_running) || null;
}

/**
 * Get stopped entries (not running)
 * @returns {Array} Array of stopped entries, sorted by created_at desc
 */
export function getStoppedEntries() {
  const entries = getLocalEntries();
  return entries
    .filter((e) => !e.is_running)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Start a new timer
 * Stops any currently running timer first
 * @returns {Object} The new running entry
 */
export function startLocalTimer() {
  // Stop any running timer first
  const running = getRunningEntry();
  if (running) {
    stopLocalTimer(running.id);
  }

  return addLocalEntry({
    start_time: new Date().toISOString(),
    is_running: true,
  });
}

/**
 * Stop a running timer
 * @param {string} id - Entry ID to stop
 * @returns {Object|null} Stopped entry or null if not found
 */
export function stopLocalTimer(id) {
  const entry = getLocalEntries().find((e) => e.id === id);
  if (!entry) return null;

  const endTime = new Date();
  const startTime = new Date(entry.start_time);
  const durationMs = endTime.getTime() - startTime.getTime();

  return updateLocalEntry(id, {
    end_time: endTime.toISOString(),
    is_running: false,
    duration_ms: durationMs > 0 ? durationMs : null,
  });
}

/**
 * Delete a local entry
 * @param {string} id - Entry ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteLocalEntry(id) {
  const entries = getLocalEntries();
  const index = entries.findIndex((e) => e.id === id);

  if (index === -1) {
    return false;
  }

  entries.splice(index, 1);
  saveLocalEntries(entries);
  return true;
}

/**
 * Clear all local entries
 * Used after successful sync to database
 */
export function clearLocalEntries() {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing local entries:", error);
  }
}

/**
 * Get count of local entries
 * @returns {number} Number of entries stored locally
 */
export function getLocalEntryCount() {
  return getLocalEntries().length;
}
