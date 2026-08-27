// lib/stores/preferencesStore.ts
// Replaces the web app's localStorage-backed dashboard-widget preference
// (sneltrack/lib/preferences/dashboardWidgets.js) with AsyncStorage.
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SHOW_DASHBOARD_WIDGETS_KEY = "sneltrack:showDashboardWidgets";

interface PreferencesState {
  showDashboardWidgets: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setShowDashboardWidgets: (enabled: boolean) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  showDashboardWidgets: true,
  hydrated: false,
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(SHOW_DASHBOARD_WIDGETS_KEY);
      set({ showDashboardWidgets: stored === null ? true : stored === "true", hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setShowDashboardWidgets: async (enabled: boolean) => {
    set({ showDashboardWidgets: enabled });
    try {
      await AsyncStorage.setItem(SHOW_DASHBOARD_WIDGETS_KEY, String(enabled));
    } catch {
      // Best-effort persistence; in-memory state already updated.
    }
  },
}));
