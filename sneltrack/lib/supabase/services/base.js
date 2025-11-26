/**
 * Base service utilities for Supabase operations
 * Provides common patterns for fire-and-forget operations and error handling
 */

/**
 * Wraps an async function to execute as fire-and-forget (non-blocking)
 * Errors are caught and logged but never thrown
 *
 * @param {Function} fn - Async function to execute
 * @param {string} entity - Entity name for logging (e.g., 'time_entry')
 * @param {string} operation - Operation name for logging (e.g., 'create', 'update')
 * @param {string} id - Entity ID for logging context
 */
export function fireAndForget(fn, entity, operation, id = null) {
  // Execute asynchronously without blocking
  Promise.resolve()
    .then(() => fn())
    .catch((error) => {
      logError(entity, operation, error, id);
    });
}

/**
 * Logs errors with consistent formatting and context
 *
 * @param {string} entity - Entity name (e.g., 'time_entry')
 * @param {string} operation - Operation name (e.g., 'create', 'update')
 * @param {Error} error - The error object
 * @param {string|null} id - Entity ID for context
 */
export function logError(entity, operation, error, id = null) {
  const context = id ? `[${entity}:${id}]` : `[${entity}]`;
  console.error(
    `Supabase sync error ${context} - ${operation}:`,
    error.message || error,
    error.stack || ""
  );
}

/**
 * Safely converts a value to ISO string, handling null/undefined
 *
 * @param {any} value - Value to convert (Date, string, or null/undefined)
 * @returns {string|null} ISO string or null
 */
export function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
