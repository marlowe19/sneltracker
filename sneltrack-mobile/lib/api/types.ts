// lib/api/types.ts
// Shapes mirror the actual Next.js API route responses under sneltrack/app/my/**.
// See MOBILE-SPEC.md "Verification requirement" — every field here was confirmed
// against the corresponding route.js file, not guessed.

export interface ApiUser {
  id: string;
  user_name: string;
  display_name: string | null;
}

// GET /my/api/user -> { user: ApiUser }
export interface UserResponse {
  user: ApiUser;
}

// POST /my/start -> { status: "running", user, startedAt }
export interface StartTimerResponse {
  status: "running";
  user: string;
  startedAt: string;
}

// POST /my/stop -> single-entry shape (most common) or multi-entry shape
export interface StopTimerSingleResponse {
  status: "stopped";
  user: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

export interface StopTimerMultiResponse {
  status: "stopped";
  user: string;
  entries: Array<{ id: string; startedAt: string; endedAt: string; durationMs: number }>;
}

export interface StopTimerIdleResponse {
  status: "idle";
  user: string;
}

export type StopTimerResponse = StopTimerSingleResponse | StopTimerMultiResponse | StopTimerIdleResponse;

// Time entry row, as returned by getWeekEntries / getDayEntries (Supabase timeEntriesService).
export interface TimeEntry {
  id: string;
  user_name: string;
  user_display_name?: string | null;
  project_id: string | null;
  activity_id?: string | null;
  activity_type?: string | null;
  hourly_rate: number | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  billable?: boolean | null;
  [key: string]: unknown;
}

// GET /my/api/week-entries?weekStart=&weekEnd= -> { entries }
export interface WeekEntriesResponse {
  entries: TimeEntry[];
}

// GET /my/api/day-entries?dayDate=YYYY-MM-DD -> { entries }
export interface DayEntriesResponse {
  entries: TimeEntry[];
}

// PATCH /my/entries/[entryId] -> { entry }
export interface UpdateEntryResponse {
  entry: TimeEntry;
}

// DELETE /my/entries/[entryId] -> { success: true }
export interface SuccessResponse {
  success: true;
}

export interface ProjectMemberStat {
  user_name: string;
  billableHours?: number;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  client?: string | null;
  hourly_rate: number | null;
  budget_hours: number | null;
  total_hours?: number;
  is_shared?: boolean;
  is_owner?: boolean;
  is_default?: boolean;
  color?: string | null;
  members?: ProjectMemberStat[];
  status?: string;
  due_date?: string | null;
  [key: string]: unknown;
}

// GET /my/projecten/api -> { projects }
export interface ProjectsResponse {
  projects: Project[];
}

// GET /my/projecten/api?projectId=&stats=true -> { statistics }
export interface ProjectStatisticsResponse {
  statistics: {
    totalHours: number;
    totalMoney: number;
    entryCount: number;
    budgetHours: number | null;
    budgetPercentage: number | null;
    budgetPrice: number | null;
    isOverBudget: boolean;
    hoursSaved: number | null;
    hoursSavedPercentage: number | null;
    moneySaved: number | null;
    profitabilityStatus: string | null;
  };
}

// GET /my/projecten/[id]/api?action=entries -> { timeEntries, expenses }
export interface ProjectEntriesResponse {
  timeEntries: TimeEntry[];
  expenses: unknown[];
}

// GET /my/api/day-expenses?dayDate= -> { expenses }
export interface DayExpense {
  id: string;
  user_name: string;
  price: number;
  name?: string;
  category?: "business" | "private";
  [key: string]: unknown;
}

export interface DayExpensesResponse {
  expenses: DayExpense[];
}

// GET /my/expenses?weekStart=&weekEnd= -> { expenses } (sneltrack/app/my/expenses/route.js GET)
// weekStart/weekEnd are ISO datetime strings (same as week-entries); the
// server converts them to calendar dates via formatDateForAPI before
// querying. Rows carry `date` (YYYY-MM-DD) and `user_name`/`user_display_name`
// so per-day and per-user aggregation mirrors WeekEntriesClient.js exactly.
export interface WeekExpense {
  id: string;
  user_name: string;
  user_display_name?: string | null;
  price: number;
  date: string;
  name?: string;
  project?: string | null;
  expense_type?: string;
  [key: string]: unknown;
}

export interface WeekExpensesResponse {
  expenses: WeekExpense[];
}

// GET /my/api/fixed-expenses -> { expenses }
export interface FixedExpense {
  id: string;
  name: string;
  price: number;
  period: "month" | "quarter" | "year";
  category: "business" | "private";
}

export interface FixedExpensesResponse {
  expenses: FixedExpense[];
}

// GET /my/api/activities -> { activities }
export interface Activity {
  id: string;
  name: string;
  hourly_rate: number | null;
  icon?: string | null;
  color_hex?: string | null;
  display_order?: number;
  archived?: boolean;
}

export interface ActivitiesResponse {
  activities: Activity[];
}

// GET /my/api/xp -> full XP breakdown (see lib/supabase/services/xpService.js#getUserXP)
export interface XpFormulaResult {
  raw: unknown;
  xp: number;
  formula: string;
}

export interface XpResponse {
  period: string;
  periodLabel: string;
  totalXP: number;
  breakdown: {
    volume: XpFormulaResult;
    value: XpFormulaResult;
    growth: XpFormulaResult;
    consistency: XpFormulaResult;
  };
  inputs: {
    total_hours: number;
    total_revenue: number;
    active_days_count: number;
    active_weeks_count: number;
    weeks_in_month: number;
  };
  streakBonuses: { daily: number; weekly: number };
  streak: { daily: number; weekly: number };
  lifetimeXP: number;
}

// POST /my/api/dashboard-stats -> see lib/supabase/services/dashboardStatsService.js
export interface DashboardStatsResponse {
  weekly: {
    thisWeekHours: number;
    avgPrevTwoWeeksHours: number;
    hoursPct: number | null;
    hoursTrend: "up" | "down" | "flat";
    thisWeekRevenue: number;
    avgPrevTwoWeeksRevenue: number;
    revenuePct: number | null;
    revenueTrend: "up" | "down" | "flat";
  };
  monthFinance: {
    earnings: number;
    hours: number;
    fixedBusinessCostsMonthly: number;
    projectExpensesMonthly: number;
    businessCostsMonthly: number;
    privateCostsMonthly: number;
    businessCostsYearly: number;
    profit: number;
    taxReserve: number;
    taxReservePct: number;
    netAfterTax: number;
    freeToSpend: number;
    expensePercentage: number;
  };
}

// GET /my/api/agenda -> raw planning inputs (AI generation is POST, deferred — see lib/api/agenda.ts)
export interface AgendaCalendarEvent {
  id?: string;
  title?: string;
  start: string;
  end: string;
  [key: string]: unknown;
}

export interface AgendaProject {
  id: string;
  name: string;
  color?: string | null;
  [key: string]: unknown;
}

export interface AgendaResponse {
  calendarEvents: AgendaCalendarEvent[];
  projects: AgendaProject[];
  users: unknown[];
  workPreferences: { workdayStart: number; workdayEnd: number; workdays: number[] };
  holidays: string[];
  dateRange: { start: string; end: string };
}

export interface AgendaPlanningItem {
  id: string;
  type: "task" | "travel" | "break";
  projectId: string | null;
  taskId: string | null;
  title: string;
  start: string;
  end: string;
  locationId: string | null;
  notes: string | null;
}

export interface AgendaPlanningDay {
  date: string;
  items: AgendaPlanningItem[];
}

export interface AgendaGenerateResponse extends AgendaResponse {
  planning: { days: AgendaPlanningDay[] };
}

export interface ApiErrorBody {
  error: string;
  message?: string;
}
