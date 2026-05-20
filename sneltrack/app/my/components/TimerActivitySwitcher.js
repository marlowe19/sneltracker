"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";

function sortProjectActivities(rows) {
  return [...(rows || [])].sort(
    (a, b) =>
      (a.display_order ?? 0) - (b.display_order ?? 0) ||
      String(a.name || "").localeCompare(String(b.name || ""), "nl")
  );
}

function getProfileActivitiesNotOnProject(projectActivities, userActivities) {
  const pas = projectActivities || [];
  const linkedUaIds = new Set(
    pas.map((pa) => pa.user_activity_id).filter(Boolean)
  );
  const projectNames = new Set(
    pas.map((pa) => String(pa.name || "").trim().toLowerCase()).filter(Boolean)
  );
  return (userActivities || []).filter((ua) => {
    if (linkedUaIds.has(ua.id)) return false;
    const n = String(ua.name || "").trim().toLowerCase();
    if (n && projectNames.has(n)) return false;
    return true;
  });
}

function projectActivityDisplayRate(pa) {
  if (pa == null) return null;
  const r = pa.effective_hourly_rate ?? pa.hourly_rate;
  return r != null && r !== "" ? r : null;
}

function getActivityIcon(activity) {
  const iconKey =
    typeof activity?.icon === "string"
      ? activity.icon.toLowerCase()
      : typeof activity?.icon === "object" && activity?.icon != null
        ? String(activity.icon.name || activity.icon.id || "")
            .toLowerCase()
            .trim() || null
        : null;

  if (iconKey) {
    const iconMap = {
      car: "🚗",
      "fork-knife": "🍽️",
      briefcase: "💼",
      wrench: "🔧",
      tools: "🔧",
      travel: "🚗",
      lunch: "🍽️",
      work: "💼",
      meeting: "👥",
      phone: "📞",
      email: "📧",
      code: "💻",
      design: "🎨",
      default: "⚙️",
    };
    return iconMap[iconKey] || iconMap.default;
  }

  const name = String(activity?.name ?? activity?.activity_type ?? "")
    .toLowerCase();
  if (name.includes("reizen") || name.includes("travel")) return "🚗";
  if (name.includes("lunch") || name.includes("eten")) return "🍽️";
  if (name.includes("materiaal") || name.includes("material")) return "📦";
  if (name.includes("monteren") || name.includes("install")) return "🔧";
  if (name.includes("electra") || name.includes("electrical")) return "⚡";
  if (name.includes("werk") || name.includes("work")) return "💼";
  if (name.includes("meeting") || name.includes("vergadering")) return "👥";
  return "⚙️";
}

function formatMoney(amount) {
  if (!amount && amount !== 0) return "";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDuration(ms) {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export default function TimerActivitySwitcher({
  entryId,
  projectId,
  userActivities: userActivitiesProp = [],
  currentTime,
  onActivitySwitched,
}) {
  const [projectActivities, setProjectActivities] = useState([]);
  const [userActivities, setUserActivities] = useState(userActivitiesProp);
  const [timerActivities, setTimerActivities] = useState([]);
  const [currentActivity, setCurrentActivity] = useState(null);
  const [loadingProject, setLoadingProject] = useState(Boolean(projectId));
  const [switching, setSwitching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setUserActivities(userActivitiesProp);
  }, [userActivitiesProp]);

  useEffect(() => {
    if (!projectId) {
      setProjectActivities([]);
      setLoadingProject(false);
      return;
    }
    let cancelled = false;
    setLoadingProject(true);
    fetch(`/my/projects/${projectId}/activities`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { activities: [] }))
      .then((data) => {
        if (!cancelled) {
          setProjectActivities(sortProjectActivities(data.activities || []));
        }
      })
      .catch(() => {
        if (!cancelled) setProjectActivities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProject(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (userActivitiesProp.length > 0) return;
    fetch("/my/api/activities", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { activities: [] }))
      .then((d) => setUserActivities(d.activities || []))
      .catch(() => setUserActivities([]));
  }, [userActivitiesProp.length]);

  const fetchTimerActivities = async () => {
    try {
      const res = await fetch(`/my/entries/${entryId}/activities`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.activities || [];
        setTimerActivities(list);
        const active = list.find((a) => !a.end_time);
        setCurrentActivity(active || null);
        if (list.length > 0) setIsExpanded(true);
      }
    } catch (error) {
      console.error("Error fetching timer activities:", error);
    }
  };

  useEffect(() => {
    if (entryId) fetchTimerActivities();
  }, [entryId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  const profileExtraActivities = useMemo(
    () => getProfileActivitiesNotOnProject(projectActivities, userActivities),
    [projectActivities, userActivities]
  );

  const pickerOptions = useMemo(() => {
    const options = [];
    projectActivities.forEach((pa) => {
      options.push({
        key: `project:${pa.id}`,
        type: "project",
        name: pa.name,
        hourly_rate: projectActivityDisplayRate(pa),
        user_activity_id: pa.user_activity_id ?? null,
      });
    });
    profileExtraActivities.forEach((ua) => {
      options.push({
        key: `user:${ua.id}`,
        type: "user",
        name: ua.name,
        hourly_rate: ua.hourly_rate ?? null,
        user_activity_id: ua.id,
      });
    });
    return options;
  }, [projectActivities, profileExtraActivities]);

  async function handleSwitchActivity(option) {
    if (switching) return;
    const isActive =
      currentActivity?.activity_type === option.name &&
      (option.type !== "user" ||
        !option.user_activity_id ||
        currentActivity?.user_activity_id === option.user_activity_id);

    if (isActive) {
      setIsDropdownOpen(false);
      return;
    }

    setSwitching(true);
    setIsDropdownOpen(false);
    try {
      const res = await fetch(`/my/entries/${entryId}/switch-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          activity_type: option.name,
          hourly_rate: option.hourly_rate ?? null,
          user_activity_id: option.user_activity_id ?? null,
        }),
      });

      if (res.ok) {
        await fetchTimerActivities();
        onActivitySwitched?.();
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Error switching activity:", data.error);
      }
    } catch (error) {
      console.error("Error switching activity:", error);
    } finally {
      setSwitching(false);
    }
  }

  function calculateActivityEarnings(activity) {
    if (!activity.hourly_rate) return 0;
    const nowMs = typeof currentTime === "number" ? currentTime : Date.now();
    const durationMs =
      activity.duration_ms ||
      (activity.end_time
        ? new Date(activity.end_time).getTime() -
          new Date(activity.start_time).getTime()
        : nowMs - new Date(activity.start_time).getTime());
    const hours = durationMs / (1000 * 60 * 60);
    return hours * parseFloat(activity.hourly_rate);
  }

  function activityDurationMs(activity) {
    if (activity.duration_ms) return activity.duration_ms;
    if (activity.end_time) {
      return (
        new Date(activity.end_time).getTime() -
        new Date(activity.start_time).getTime()
      );
    }
    const nowMs = typeof currentTime === "number" ? currentTime : Date.now();
    return nowMs - new Date(activity.start_time).getTime();
  }

  const currentOption = pickerOptions.find(
    (o) => o.name === currentActivity?.activity_type
  );

  const hasSelectableActivities = pickerOptions.length > 0;
  const hasBreakdown = timerActivities.length > 0;
  const isLoading = loadingProject && Boolean(projectId);

  if (!hasSelectableActivities && !hasBreakdown && !currentActivity && !isLoading) {
    return null;
  }

  return (
    <div className="mt-2 w-full space-y-2">
      {hasSelectableActivities && (
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={switching}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <span className="flex items-center gap-1.5 flex-1 text-left min-w-0">
              {currentOption || currentActivity ? (
                <>
                  <span className="text-lg shrink-0">
                    {getActivityIcon(
                      currentOption ?? {
                        name: currentActivity?.activity_type,
                      }
                    )}
                  </span>
                  <span className="truncate">
                    {currentOption?.name || currentActivity.activity_type}
                    {(currentOption?.hourly_rate ?? currentActivity?.hourly_rate) !=
                      null && (
                      <span className="ml-1 text-sm text-gray-500">
                        {formatMoney(
                          currentOption?.hourly_rate ?? currentActivity.hourly_rate
                        )}
                        /u
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span>Wissel activiteit</span>
              )}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-400 shrink-0 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {projectActivities.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Project
                  </div>
                  {projectActivities.map((pa) => {
                    const option = {
                      key: `project:${pa.id}`,
                      type: "project",
                      name: pa.name,
                      hourly_rate: projectActivityDisplayRate(pa),
                      user_activity_id: pa.user_activity_id ?? null,
                      icon: pa,
                    };
                    const isActive =
                      currentActivity?.activity_type === pa.name;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => handleSwitchActivity(option)}
                        disabled={switching || isActive}
                        className={`w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center gap-2 border-t border-gray-100 ${
                          isActive ? "bg-blue-50" : ""
                        } disabled:opacity-50`}
                      >
                        <span className="text-lg">{getActivityIcon(pa)}</span>
                        <span className="flex-1">{pa.name}</span>
                        {option.hourly_rate != null && (
                          <span className="text-sm text-gray-500 shrink-0">
                            {formatMoney(option.hourly_rate)}/u
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
              {profileExtraActivities.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500 border-t border-gray-100">
                    {projectId ? "Profiel" : "Activiteiten"}
                  </div>
                  {profileExtraActivities.map((ua) => {
                    const option = {
                      key: `user:${ua.id}`,
                      type: "user",
                      name: ua.name,
                      hourly_rate: ua.hourly_rate ?? null,
                      user_activity_id: ua.id,
                      icon: ua,
                    };
                    const isActive =
                      currentActivity?.activity_type === ua.name;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => handleSwitchActivity(option)}
                        disabled={switching || isActive}
                        className={`w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center gap-2 border-t border-gray-100 ${
                          isActive ? "bg-blue-50" : ""
                        } disabled:opacity-50`}
                      >
                        <span className="text-lg">{getActivityIcon(ua)}</span>
                        <span className="flex-1">{ua.name}</span>
                        {ua.hourly_rate != null && (
                          <span className="text-sm text-gray-500 shrink-0">
                            {formatMoney(ua.hourly_rate)}/u
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && !hasSelectableActivities && (
        <p className="text-xs text-gray-500">Activiteiten laden…</p>
      )}

      {hasBreakdown && (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={16} />
                Breakdown verbergen
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Breakdown tonen ({timerActivities.length})
              </>
            )}
          </button>

          {isExpanded && (
            <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/80 p-2">
              {timerActivities.map((activity) => {
                const earnings = calculateActivityEarnings(activity);
                const isActive = !activity.end_time;
                return (
                  <div
                    key={activity.id}
                    className={`flex items-start justify-between gap-2 text-sm ${
                      isActive ? "font-medium" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span>{activity.activity_type}</span>
                      <span className="ml-1 text-gray-500">
                        {new Date(activity.start_time).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {activity.end_time ? (
                          <>
                            {" – "}
                            {new Date(activity.end_time).toLocaleTimeString(
                              "nl-NL",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </>
                        ) : (
                          <span className="ml-1 text-emerald-600">(actief)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <span className="text-gray-600 tabular-nums">
                        {formatDuration(activityDurationMs(activity))}
                      </span>
                      {earnings > 0 && (
                        <span className="tabular-nums">{formatMoney(earnings)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
