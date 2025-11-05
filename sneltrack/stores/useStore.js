import { create } from "zustand";
import { devtools } from "zustand/middleware";

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

      // ========== UI State ==========
      openDropdowns: {},
      stoppedTimers: {},
      pendingTimers: [],

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
            `/${encodeURIComponent(
              user
            )}/api/week-entries?weekStart=${weekStart}&weekEnd=${weekEnd}`
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

      // Optimistic updates for entries
      addEntry: (newEntry) => {
        set((state) => ({
          entries: [
            ...state.entries,
            { ...newEntry, id: `temp-${Date.now()}` },
          ],
        }));
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
      fetchProjects: async (user) => {
        set({ loadingProjects: true, projectsError: null });
        try {
          const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`);
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
