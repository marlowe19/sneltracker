/**
 * Supabase Services
 * Central export point for all Supabase service modules
 * This pattern can be extended for other entities (projects, expenses, etc.)
 */

export * from "./base";
export * as timeEntriesService from "./timeEntriesService";
export * as projectsService from "./projectsService";
export * as reportsService from "./reportsService";
export * as expensesService from "./expensesService";

