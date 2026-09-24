// lib/logic/utils/projectProgress.ts
// Ported 1:1 from sneltrack/lib/utils/projectProgress.js
// Client-side utilities for calculating project progress metrics.

export interface ProjectProgressInput {
  total_hours?: number;
  budget_hours?: number | null;
}

export type StatusColor = "gray" | "green" | "yellow" | "orange" | "red";

export interface ProjectProgress {
  percentage: number;
  hoursRemaining: number | null;
  isOverBudget: boolean;
  statusColor: StatusColor;
  formattedPercentage: string;
  formattedRemaining: string | null;
}

export function calculateProjectProgress(project: ProjectProgressInput): ProjectProgress {
  const total_hours = project.total_hours ?? 0;
  const budget_hours = project.budget_hours;

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
  let statusColor: StatusColor = "green";
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

export function getProgressBarColorClass(statusColor: StatusColor, variant: string = "tailwind"): string {
  if (variant === "tailwind") {
    const colorMap: Record<StatusColor, string> = {
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

export function getProgressTextColorClass(statusColor: StatusColor): string {
  const colorMap: Record<StatusColor, string> = {
    green: "text-green-600",
    yellow: "text-yellow-600",
    orange: "text-orange-600",
    red: "text-red-600",
    gray: "text-gray-600",
  };
  return colorMap[statusColor] || "text-gray-600";
}

/**
 * Format hours for display, e.g. "10u 30m" or "45m".
 */
export function formatHours(hours: number | null | undefined): string {
  if (!hours || hours === 0) return "0m";

  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);

  if (h === 0) {
    return `${m}m`;
  }

  return m > 0 ? `${h}u ${m}m` : `${h}u`;
}

export function hasBudgetTracking(project: ProjectProgressInput): boolean {
  return Boolean(project.budget_hours && project.budget_hours > 0);
}
