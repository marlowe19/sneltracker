import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Format date as YYYY-MM-DD in local timezone (not UTC)
// This ensures the correct day is used regardless of timezone
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const useStore = create(
  devtools(
    (set, get) => ({
      // ========== Entries State ==========
      entries: [], // Week entries - fetched client-side only
      activeEntries: [], // Active timers - hydrated from server, then managed client-side
      stoppedTimers: [], // Stopped timers for today - hydrated from server
      loadingEntries: false, // Loading state for week entries
      entriesError: null,
      weekOffset: 0,

      // ========== Projects State ==========
      projects: [],
      loadingProjects: false,
      projectsError: null,

      // ========== Expenses State ==========
      expenses: [], // Day expenses - fetched client-side only
      loadingExpenses: false,
      expensesError: null,
      weekExpenses: [], // Week expenses - fetched client-side only
      loadingWeekExpenses: false,
      weekExpensesError: null,

      // ========== UI State ==========
      openDropdowns: {},
      stoppedTimers: {},
      pendingTimers: [],

      // ========== User State ==========
      userDisplayName: null,
      loadingUserDisplayName: false,
      userDisplayNameError: null,

      // ========== User Actions ==========
      fetchUserDisplayName: async () => {
        const currentState = get();
        // Prevent concurrent fetches
        if (currentState.loadingUserDisplayName) {
          return;
        }

        // If we already have the display name, don't fetch again
        if (currentState.userDisplayName) {
          return;
        }

        set({ loadingUserDisplayName: true, userDisplayNameError: null });
        try {
          const res = await fetch(`/my/api/user`);
          if (!res.ok) {
            if (res.status === 404) {
              // User not found - set display name to null
              set({ userDisplayName: null, loadingUserDisplayName: false });
              return;
            }
            throw new Error("Failed to fetch user display name");
          }
          const data = await res.json();
          set({
            userDisplayName: data.user?.display_name || null,
            loadingUserDisplayName: false,
          });
        } catch (error) {
          set({
            userDisplayNameError: error.message,
            loadingUserDisplayName: false,
          });
        }
      },

      // ========== Entries Actions ==========
      // Hydrate active entries from server (initial load)
      hydrateActiveEntries: (serverActiveEntries) => {
        set({ activeEntries: serverActiveEntries });
      },

      // Hydrate stopped timers from server (initial load)
      hydrateStoppedTimers: (serverStoppedTimers) => {
        set({ stoppedTimers: serverStoppedTimers });
      },

      // Fetch week entries client-side
      fetchWeekEntries: async (user, weekStart, weekEnd) => {
        set({ loadingEntries: true, entriesError: null });
        try {
          const res = await fetch(
            `/my/api/week-entries?weekStart=${weekStart}&weekEnd=${weekEnd}`
          );
          if (!res.ok) throw new Error("Failed to fetch week entries");
          const data = await res.json();
          set({ entries: data.entries, loadingEntries: false });
        } catch (error) {
          set({ entriesError: error.message, loadingEntries: false });
        }
      },

      // Update week offset
      setWeekOffset: (offset) => set({ weekOffset: offset }),

      // Fetch day entries client-side
      fetchDayEntries: async (user, dayDate) => {
        // Don't block on loadingEntries - day entries can fetch independently
        // This allows the modal to open even if week entries are still loading
        try {
          const dateStr = formatLocalDate(dayDate);
          const res = await fetch(`/my/api/day-entries?dayDate=${dateStr}`);
          if (!res.ok) throw new Error("Failed to fetch day entries");
          const data = await res.json();
          // Merge with existing entries, avoiding duplicates
          set((state) => {
            const existingIds = new Set(state.entries.map((e) => e.id));
            const newEntries = data.entries.filter(
              (e) => !existingIds.has(e.id)
            );
            return {
              entries: [...state.entries, ...newEntries],
            };
          });
        } catch (error) {
          // Silently handle errors - don't block the modal from opening
          console.error("Error fetching day entries:", error);
        }
      },

      // Optimistic updates for entries
      addEntry: (newEntry) => {
        set((state) => {
          // If entry already has an ID, use it (e.g., stopped timers)
          // Otherwise, add a temp ID for new entries
          const entryWithId = newEntry.id
            ? newEntry
            : { ...newEntry, id: `temp-${Date.now()}` };

          // Check if entry with this ID already exists to avoid duplicates
          const existingIndex = state.entries.findIndex(
            (e) => e.id === entryWithId.id
          );

          if (existingIndex !== -1) {
            // Update existing entry
            const updatedEntries = [...state.entries];
            updatedEntries[existingIndex] = entryWithId;
            return { entries: updatedEntries };
          } else {
            // Add new entry
            return { entries: [...state.entries, entryWithId] };
          }
        });
      },

      updateEntry: (entryId, updates) => {
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === entryId ? { ...entry, ...updates } : entry
          ),
          // Also update activeEntries if it's an active entry
          activeEntries: state.activeEntries.map((entry) =>
            entry.id === entryId ? { ...entry, ...updates } : entry
          ),
        }));
      },

      replaceTempEntry: (tempId, realEntry) => {
        set((state) => {
          const entryIndex = state.entries.findIndex(
            (entry) => entry.id === tempId
          );
          if (entryIndex !== -1) {
            // Replace temp entry with real entry
            const newEntries = [...state.entries];
            newEntries[entryIndex] = realEntry;
            return { entries: newEntries };
          } else {
            // Temp entry not found, add the real entry to the array
            return { entries: [...state.entries, realEntry] };
          }
        });
      },

      deleteEntry: (entryId) => {
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== entryId),
          activeEntries: state.activeEntries.filter(
            (entry) => entry.id !== entryId
          ),
        }));
      },

      // Update active entries (for when timers start/stop)
      updateActiveEntries: (entries) => {
        set({ activeEntries: entries });
      },

      // ========== Projects Actions ==========
      // Hydrate projects from server (initial load)
      hydrateProjects: (serverProjects) => {
        set({ projects: serverProjects || [] });
      },

      fetchProjects: async (user) => {
        const currentState = get();
        // Prevent concurrent fetches
        if (currentState.loadingProjects) {
          return;
        }

        set({ loadingProjects: true, projectsError: null });
        try {
          const res = await fetch(`/my/projecten/api`);
          if (!res.ok) throw new Error("Failed to fetch projects");
          const data = await res.json();
          set({ projects: data.projects || [], loadingProjects: false });
        } catch (error) {
          set({ projectsError: error.message, loadingProjects: false });
        }
      },

      addProject: (project) => {
        set((state) => ({ projects: [...state.projects, project] }));
      },

      updateProject: (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
        }));
      },

      // ========== Expenses Actions ==========
      fetchDayExpenses: async (user, dayDate) => {
        const currentState = get();
        // Prevent concurrent fetches
        if (currentState.loadingExpenses) {
          return;
        }

        set({ loadingExpenses: true, expensesError: null });
        try {
          const dateStr = formatLocalDate(dayDate);
          const res = await fetch(`/my/api/day-expenses?dayDate=${dateStr}`);
          if (!res.ok) throw new Error("Failed to fetch day expenses");
          const data = await res.json();
          set({ expenses: data.expenses || [], loadingExpenses: false });
        } catch (error) {
          set({ expensesError: error.message, loadingExpenses: false });
        }
      },

      fetchWeekExpenses: async (user, weekStart, weekEnd) => {
        const currentState = get();
        // Prevent concurrent fetches
        if (currentState.loadingWeekExpenses) {
          return;
        }

        set({ loadingWeekExpenses: true, weekExpensesError: null });
        try {
          const res = await fetch(
            `my/expenses?weekStart=${weekStart}&weekEnd=${weekEnd}`
          );
          if (!res.ok) throw new Error("Failed to fetch week expenses");
          const data = await res.json();
          set({
            weekExpenses: data.expenses || [],
            loadingWeekExpenses: false,
          });
        } catch (error) {
          set({ weekExpensesError: error.message, loadingWeekExpenses: false });
        }
      },

      addExpense: (newExpense) => {
        const tempId = `temp-${Date.now()}`;
        set((state) => ({
          expenses: [...state.expenses, { ...newExpense, id: tempId }],
          weekExpenses: [...state.weekExpenses, { ...newExpense, id: tempId }],
        }));
      },

      updateExpense: (expenseId, updates) => {
        set((state) => ({
          expenses: state.expenses.map((expense) =>
            expense.id === expenseId ? { ...expense, ...updates } : expense
          ),
          weekExpenses: state.weekExpenses.map((expense) =>
            expense.id === expenseId ? { ...expense, ...updates } : expense
          ),
        }));
      },

      replaceTempExpense: (tempId, realExpense) => {
        set((state) => {
          const expenseIndex = state.expenses.findIndex(
            (expense) => expense.id === tempId
          );
          const weekExpenseIndex = state.weekExpenses.findIndex(
            (expense) => expense.id === tempId
          );

          let newExpenses = state.expenses;
          let newWeekExpenses = state.weekExpenses;

          if (expenseIndex !== -1) {
            newExpenses = [...state.expenses];
            newExpenses[expenseIndex] = realExpense;
          } else {
            newExpenses = [...state.expenses, realExpense];
          }

          if (weekExpenseIndex !== -1) {
            newWeekExpenses = [...state.weekExpenses];
            newWeekExpenses[weekExpenseIndex] = realExpense;
          } else {
            newWeekExpenses = [...state.weekExpenses, realExpense];
          }

          return { expenses: newExpenses, weekExpenses: newWeekExpenses };
        });
      },

      deleteExpense: (expenseId) => {
        set((state) => ({
          expenses: state.expenses.filter(
            (expense) => expense.id !== expenseId
          ),
          weekExpenses: state.weekExpenses.filter(
            (expense) => expense.id !== expenseId
          ),
        }));
      },

      // ========== UI Actions ==========
      toggleDropdown: (timerId) => {
        set((state) => ({
          openDropdowns: {
            ...state.openDropdowns,
            [timerId]: !state.openDropdowns[timerId],
          },
        }));
      },

      closeDropdown: (timerId) => {
        set((state) => ({
          openDropdowns: { ...state.openDropdowns, [timerId]: false },
        }));
      },

      setStoppedTimer: (entryId, stopTime) => {
        set((state) => ({
          stoppedTimers: { ...state.stoppedTimers, [entryId]: stopTime },
        }));
      },

      addPendingTimer: (timer) => {
        set((state) => ({ pendingTimers: [...state.pendingTimers, timer] }));
      },

      removePendingTimer: (timerId) => {
        set((state) => ({
          pendingTimers: state.pendingTimers.filter((t) => t.id !== timerId),
        }));
      },

      updatePendingTimer: (timerId, updates) => {
        set((state) => ({
          pendingTimers: state.pendingTimers.map((t) =>
            t.id === timerId ? { ...t, ...updates } : t
          ),
        }));
      },

      clearPendingTimers: () => {
        set({ pendingTimers: [] });
      },
    }),
    { name: "AppStore" }
  )
);
