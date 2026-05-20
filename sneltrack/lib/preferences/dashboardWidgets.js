const STORAGE_KEY = "sneltrack:showDashboardWidgets";

export function getShowDashboardWidgets() {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return true;
    }
    return stored === "true";
  } catch {
    return true;
  }
}

export function setShowDashboardWidgets(enabled) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // ignore quota / private mode errors
  }
}
