// lib/api/endpoints.ts
// Thin, typed wrappers around each backend route. Every path/method/param
// here was confirmed against the actual route.js file (see MOBILE-SPEC.md's
// verification requirement) — no invented endpoints.
import { apiFetch } from "./client";
import type {
  ActivitiesResponse,
  AgendaGenerateResponse,
  AgendaResponse,
  DashboardStatsResponse,
  DayEntriesResponse,
  DayExpensesResponse,
  FixedExpensesResponse,
  ProjectEntriesResponse,
  ProjectStatisticsResponse,
  ProjectsResponse,
  StartTimerResponse,
  StopTimerResponse,
  SuccessResponse,
  UpdateEntryResponse,
  UserResponse,
  WeekEntriesResponse,
  XpResponse,
} from "./types";

// --- Auth / user --------------------------------------------------------
// GET /my/api/user (sneltrack/app/my/api/user/route.js)
export function fetchCurrentUser(): Promise<UserResponse> {
  return apiFetch<UserResponse>("/my/api/user");
}

// --- Timer ---------------------------------------------------------------
// POST /my/start (sneltrack/app/my/start/route.js)
export interface StartTimerArgs {
  project?: string;
  rate?: number;
  activity_id?: string;
  activity_type?: string;
  activity_hourly_rate?: number;
}
export function startTimer(args: StartTimerArgs): Promise<StartTimerResponse> {
  return apiFetch<StartTimerResponse>("/my/start", { method: "POST", body: args });
}

// POST /my/stop (sneltrack/app/my/stop/route.js)
export function stopTimer(entryId?: string | null): Promise<StopTimerResponse> {
  return apiFetch<StopTimerResponse>("/my/stop", { method: "POST", body: { entryId: entryId ?? null } });
}

// --- Entries ---------------------------------------------------------------
// GET /my/api/week-entries?weekStart=&weekEnd= (sneltrack/app/my/api/week-entries/route.js)
export function fetchWeekEntries(weekStart: string, weekEnd: string): Promise<WeekEntriesResponse> {
  return apiFetch<WeekEntriesResponse>("/my/api/week-entries", { query: { weekStart, weekEnd } });
}

// GET /my/api/day-entries?dayDate=YYYY-MM-DD (sneltrack/app/my/api/day-entries/route.js)
export function fetchDayEntries(dayDate: string): Promise<DayEntriesResponse> {
  return apiFetch<DayEntriesResponse>("/my/api/day-entries", { query: { dayDate } });
}

// PATCH /my/entries/[entryId] (sneltrack/app/my/entries/[entryId]/route.js)
export function updateEntry(entryId: string, updates: Record<string, unknown>): Promise<UpdateEntryResponse> {
  return apiFetch<UpdateEntryResponse>(`/my/entries/${entryId}`, { method: "PATCH", body: updates });
}

// DELETE /my/entries/[entryId] (sneltrack/app/my/entries/[entryId]/route.js)
export function deleteEntry(entryId: string): Promise<SuccessResponse> {
  return apiFetch<SuccessResponse>(`/my/entries/${entryId}`, { method: "DELETE" });
}

// POST /my/entries (sneltrack/app/my/entries/route.js) — manual entry creation
export interface CreateEntryArgs {
  dayDate: string; // YYYY-MM-DD
  duration_ms?: number;
  hourly_rate?: number;
  project_id?: string;
  start_time?: string;
  end_time?: string;
}
export function createEntry(args: CreateEntryArgs): Promise<UpdateEntryResponse> {
  return apiFetch<UpdateEntryResponse>("/my/entries", { method: "POST", body: args });
}

// --- Projects ---------------------------------------------------------------
// GET /my/projecten/api (sneltrack/app/my/projecten/api/route.js)
export function fetchProjects(): Promise<ProjectsResponse> {
  return apiFetch<ProjectsResponse>("/my/projecten/api");
}

// GET /my/projecten/api?projectId=&stats=true
export function fetchProjectStatistics(projectId: string): Promise<ProjectStatisticsResponse> {
  return apiFetch<ProjectStatisticsResponse>("/my/projecten/api", { query: { projectId, stats: true } });
}

// GET /my/projecten/[projectId]/api?action=entries (sneltrack/app/my/projecten/[projectId]/api/route.js)
export function fetchProjectEntries(projectId: string): Promise<ProjectEntriesResponse> {
  return apiFetch<ProjectEntriesResponse>(`/my/projecten/${projectId}/api`, { query: { action: "entries" } });
}

// --- Expenses ---------------------------------------------------------------
// GET /my/api/day-expenses?dayDate= (sneltrack/app/my/api/day-expenses/route.js)
export function fetchDayExpenses(dayDate: string): Promise<DayExpensesResponse> {
  return apiFetch<DayExpensesResponse>("/my/api/day-expenses", { query: { dayDate } });
}

// GET /my/api/fixed-expenses (sneltrack/app/my/api/fixed-expenses/route.js)
export function fetchFixedExpenses(): Promise<FixedExpensesResponse> {
  return apiFetch<FixedExpensesResponse>("/my/api/fixed-expenses");
}

export interface CreateFixedExpenseArgs {
  name: string;
  price: number;
  period: "month" | "quarter" | "year";
  category: "business" | "private";
}
export function createFixedExpense(args: CreateFixedExpenseArgs): Promise<{ expense: unknown }> {
  return apiFetch("/my/api/fixed-expenses", { method: "POST", body: args });
}

// POST /my/expenses (sneltrack/app/my/expenses/route.js) — project-scoped
// day expense creation (name/price/expense_type against a project).
export interface CreateProjectExpenseArgs {
  dayDate: string; // YYYY-MM-DD
  project: string;
  name: string;
  price: number;
  includes_vat?: boolean;
  expense_type?: string;
}
export function createProjectExpense(args: CreateProjectExpenseArgs): Promise<{ expense: unknown }> {
  return apiFetch("/my/expenses", { method: "POST", body: args });
}

// --- Activities ---------------------------------------------------------------
// GET /my/api/activities (sneltrack/app/my/api/activities/route.js)
export function fetchActivities(): Promise<ActivitiesResponse> {
  return apiFetch<ActivitiesResponse>("/my/api/activities");
}

// --- XP ---------------------------------------------------------------
// GET /my/api/xp?period=&date= (sneltrack/app/my/api/xp/route.js)
export function fetchXp(period: "day" | "week" | "month" | "year" = "month", date?: string): Promise<XpResponse> {
  return apiFetch<XpResponse>("/my/api/xp", { query: { period, date } });
}

// --- Dashboard stats / reports ---------------------------------------------
// POST /my/api/dashboard-stats (sneltrack/app/my/api/dashboard-stats/route.js)
export interface DashboardStatsArgs {
  weeks: Array<{ start: string; end: string }>;
  month: {
    expenseFrom: string;
    expenseTo: string;
    clipStartIso: string;
    clipEndIso: string;
    entryWeekRanges: Array<{ start: string; end: string }>;
  };
  includeTeamEarnings?: boolean;
  includeProjectExpenses?: boolean;
  taxReservePct?: number;
}
export function fetchDashboardStats(args: DashboardStatsArgs): Promise<DashboardStatsResponse> {
  return apiFetch<DashboardStatsResponse>("/my/api/dashboard-stats", { method: "POST", body: args });
}

// --- Agenda ---------------------------------------------------------------
// GET /my/api/agenda (sneltrack/app/my/api/agenda/route.js)
export function fetchAgenda(): Promise<AgendaResponse> {
  return apiFetch<AgendaResponse>("/my/api/agenda");
}

// POST /my/api/agenda — generates an AI weekplanning (OpenAI-backed on the server)
export function generateAgendaPlanning(): Promise<AgendaGenerateResponse> {
  return apiFetch<AgendaGenerateResponse>("/my/api/agenda", { method: "POST" });
}
