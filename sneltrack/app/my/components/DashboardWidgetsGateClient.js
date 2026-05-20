"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/stores/useStore";
import MyDashboardWidgetsClient from "./MyDashboardWidgetsClient";

/**
 * Shows dashboard stats only when there is no running or pending timer.
 * Uses server active entries until the store has hydrated.
 */
export default function DashboardWidgetsGateClient({ initialActiveEntries = [] }) {
  const activeEntries = useStore((state) => state.activeEntries);
  const pendingTimers = useStore((state) => state.pendingTimers);
  const showDashboardWidgets = useStore((state) => state.showDashboardWidgets);
  const hydrateDashboardWidgetsPreference = useStore(
    (state) => state.hydrateDashboardWidgetsPreference,
  );
  const [storeSynced, setStoreSynced] = useState(false);

  useEffect(() => {
    hydrateDashboardWidgetsPreference();
    setStoreSynced(true);
  }, [hydrateDashboardWidgetsPreference]);

  if (!showDashboardWidgets) {
    return null;
  }

  const hasTimerTakingSpace = storeSynced
    ? activeEntries.length > 0 || pendingTimers.length > 0
    : initialActiveEntries.length > 0;

  if (hasTimerTakingSpace) {
    return null;
  }

  return <MyDashboardWidgetsClient />;
}
