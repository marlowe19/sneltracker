// lib/stores/timerStore.ts
// Running-timer state for the Vandaag screen. The backend has no single
// "current active entry" endpoint (confirmed: sneltrack/app/my/api/** has no
// such route — the web app hydrates activeEntries via a server component).
// We derive "is a timer running" the same way the data model implies it:
// a time entry with `end_time === null` is still running. We look for one
// among today's day-entries.
import { create } from "zustand";
import type { TimeEntry } from "../api/types";
import { fetchDayEntries, startTimer, stopTimer, type StartTimerArgs } from "../api/endpoints";
import { formatLocalDate } from "../logic/dateRangeUtils";

interface TimerState {
  activeEntry: TimeEntry | null;
  loading: boolean;
  error: string | null;
  refreshActiveEntry: () => Promise<void>;
  start: (args: StartTimerArgs) => Promise<void>;
  stop: () => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeEntry: null,
  loading: false,
  error: null,

  refreshActiveEntry: async () => {
    set({ loading: true, error: null });
    try {
      const todayStr = formatLocalDate(new Date());
      const { entries } = await fetchDayEntries(todayStr);
      const running = entries.find((e) => e.end_time === null || e.end_time === undefined) ?? null;
      set({ activeEntry: running, loading: false });
    } catch (err) {
      set({
        error:
          "Timerstatus laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.",
        loading: false,
      });
    }
  },

  start: async (args: StartTimerArgs) => {
    set({ loading: true, error: null });
    try {
      const res = await startTimer(args);
      set({
        activeEntry: {
          id: "pending",
          user_name: res.user,
          project_id: args.project ?? null,
          hourly_rate: args.rate ?? null,
          start_time: res.startedAt,
          end_time: null,
          duration_ms: null,
        },
        loading: false,
      });
      await get().refreshActiveEntry();
    } catch (err) {
      set({ error: "Timer starten is niet gelukt. Probeer het opnieuw.", loading: false });
      throw err;
    }
  },

  stop: async () => {
    set({ loading: true, error: null });
    try {
      await stopTimer();
      set({ activeEntry: null, loading: false });
    } catch (err) {
      set({ error: "Timer stoppen is niet gelukt. Probeer het opnieuw.", loading: false });
      throw err;
    }
  },
}));
