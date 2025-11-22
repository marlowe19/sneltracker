/**
 * Client-side utilities for calculating project progress metrics
 * Calculations done on client for flexibility and performance
 */

/**
 * Calculate comprehensive project progress metrics
 *
 * @param {Object} project - Project object with total_hours and budget_hours
 * @returns {Object} Progress metrics with percentage, remaining hours, status
 */
export function calculateProjectProgress(project) {
  const { total_hours = 0, budget_hours } = project;

  // If no budget is set, return defaults
  if (!budget_hours || budget_hours <= 0) {
    return {
      percentage: 0,
      hoursRemaining: null,
      isOverBudget: false,
      statusColor: "gray",
      formattedPercentage: "0%",
      formattedRemaining: null,
    };
  }

  // Calculate raw percentage (can exceed 100%)
  const rawPercentage = (total_hours / budget_hours) * 100;
  const percentage = Math.round(rawPercentage * 100) / 100; // 2 decimals
  const hoursRemaining = budget_hours - total_hours;
  const isOverBudget = total_hours > budget_hours;

  // Determine status color based on progress
  let statusColor = "green";
  if (isOverBudget) {
    statusColor = "red";
  } else if (percentage >= 90) {
    statusColor = "orange";
  } else if (percentage >= 80) {
    statusColor = "yellow";
  }

  return {
    percentage,
    hoursRemaining: Math.round(hoursRemaining * 100) / 100, // 2 decimals
    isOverBudget,
    statusColor,
    formattedPercentage: `${percentage.toFixed(1)}%`,
    formattedRemaining:
      hoursRemaining > 0
        ? `${hoursRemaining.toFixed(1)}u resterend`
        : `${Math.abs(hoursRemaining).toFixed(1)}u over budget`,
  };
}

/**
 * Get color class for progress bar based on status
 *
 * @param {string} statusColor - Status color (green, yellow, orange, red, gray)
 * @param {string} variant - CSS framework variant (tailwind, etc)
 * @returns {string} CSS class name
 */
export function getProgressBarColorClass(statusColor, variant = "tailwind") {
  if (variant === "tailwind") {
    const colorMap = {
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      red: "bg-red-500",
      gray: "bg-gray-400",
    };
    return colorMap[statusColor] || "bg-gray-400";
  }

  return statusColor;
}

/**
 * Get text color class based on status
 *
 * @param {string} statusColor - Status color
 * @returns {string} Tailwind text color class
 */
export function getProgressTextColorClass(statusColor) {
  const colorMap = {
    green: "text-green-600",
    yellow: "text-yellow-600",
    orange: "text-orange-600",
    red: "text-red-600",
    gray: "text-gray-600",
  };
  return colorMap[statusColor] || "text-gray-600";
}

/**
 * Format hours for display
 *
 * @param {number} hours - Total hours (can have decimals)
 * @returns {string} Formatted string like "10u 30m" or "45m"
 */
export function formatHours(hours) {
  if (!hours || hours === 0) return "0m";

  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);

  if (h === 0) {
    return `${m}m`;
  }

  return m > 0 ? `${h}u ${m}m` : `${h}u`;
}

/**
 * Check if project has meaningful budget tracking
 *
 * @param {Object} project - Project object
 * @returns {boolean} True if budget tracking is enabled
 */
export function hasBudgetTracking(project) {
  return project.budget_hours && project.budget_hours > 0;
}
