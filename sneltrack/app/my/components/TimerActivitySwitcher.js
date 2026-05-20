"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";

export default function TimerActivitySwitcher({
  entryId,
  projectId,
  currentTime,
  onActivitySwitched,
}) {
  const [activities, setActivities] = useState([]);
  const [timerActivities, setTimerActivities] = useState([]);
  const [currentActivity, setCurrentActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectActivities();
    }
  }, [projectId]);

  useEffect(() => {
    if (entryId) {
      fetchTimerActivities();
    }
  }, [entryId]);

  // Click outside handler to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  async function fetchProjectActivities() {
    try {
      const res = await fetch(`/my/projects/${projectId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Error fetching project activities:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTimerActivities() {
    try {
      const res = await fetch(`/my/entries/${entryId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setTimerActivities(data.activities || []);
        
        // Find current active activity (end_time is null)
        const active = data.activities.find((a) => !a.end_time);
        setCurrentActivity(active || null);
      }
    } catch (error) {
      console.error("Error fetching timer activities:", error);
    }
  }

  async function handleSwitchActivity(activityType, hourlyRate) {
    if (switching) return;
    
    setSwitching(true);
    setIsDropdownOpen(false); // Close dropdown after selection
    try {
      const res = await fetch(`/my/entries/${entryId}/switch-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: activityType,
          hourly_rate: hourlyRate,
        }),
      });

      if (res.ok) {
        // Refresh activities
        await fetchTimerActivities();
        // Notify parent to refresh activities data
        if (onActivitySwitched) {
          onActivitySwitched();
        }
      } else {
        const data = await res.json();
        console.error("Error switching activity:", data.error);
      }
    } catch (error) {
      console.error("Error switching activity:", error);
    } finally {
      setSwitching(false);
    }
  }

  // Simple icon mapping function
  function getActivityIcon(activity) {
    // Check if activity has icon field
    if (activity.icon) {
      // Map common icon names to emojis
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
      return iconMap[activity.icon.toLowerCase()] || iconMap.default;
    }

    // Fallback: map based on activity name
    const name = activity.name?.toLowerCase() || "";
    if (name.includes("reizen") || name.includes("travel")) return "🚗";
    if (name.includes("lunch") || name.includes("eten")) return "🍽️";
    if (name.includes("materiaal") || name.includes("material")) return "📦";
    if (name.includes("monteren") || name.includes("install")) return "🔧";
    if (name.includes("electra") || name.includes("electrical")) return "⚡";
    if (name.includes("werk") || name.includes("work")) return "💼";
    if (name.includes("meeting") || name.includes("vergadering")) return "👥";
    
    return "⚙️"; // Default icon
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

  function calculateActivityEarnings(activity) {
    if (!activity.hourly_rate) return 0;
    const durationMs = activity.duration_ms || 
      (activity.end_time ? 
        new Date(activity.end_time).getTime() - new Date(activity.start_time).getTime() :
        new Date().getTime() - new Date(activity.start_time).getTime());
    const hours = durationMs / (1000 * 60 * 60);
    return hours * parseFloat(activity.hourly_rate);
  }

  if (loading || activities.length === 0) {
    return null; // Don't show if no activities available
  }

  // Find the project activity that matches current activity
  const currentProjectActivity = activities.find(
    (a) => a.name === currentActivity?.activity_type
  );
  const currentProjectDisplayRate = currentProjectActivity
    ? currentProjectActivity.effective_hourly_rate ??
      currentProjectActivity.hourly_rate
    : null;

  return (
    <div className="mt-4 space-y-2">
      {/* Current Activity Indicator */}
      {currentActivity && (
        <div className="text-sm text-gray-600">
          Huidige: {currentActivity.activity_type}
          {currentActivity.hourly_rate && (
            <span className="ml-1">
              {formatMoney(currentActivity.hourly_rate)}/uur
            </span>
          )}
        </div>
      )}

      {/* Activity Dropdown */}
      <div
        ref={dropdownRef}
        className="relative"
      >
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full py-2 text-base text-gray-700 flex items-center gap-2 border border-gray-300 rounded-lg px-3 bg-white hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-1.5 flex-1 text-left">
            {currentProjectActivity ? (
              <>
                <span className="text-lg">{getActivityIcon(currentProjectActivity)}</span>
                <span>
                  {currentProjectActivity.name}
                  {currentProjectDisplayRate != null &&
                    currentProjectDisplayRate !== "" && (
                    <span className="ml-1 text-sm text-gray-500">
                      {formatMoney(currentProjectDisplayRate)}/u
                    </span>
                  )}
                </span>
              </>
            ) : currentActivity ? (
              <>
                <span className="text-lg">⚙️</span>
                <span>
                  {currentActivity.activity_type}
                  {currentActivity.hourly_rate && (
                    <span className="ml-1 text-sm text-gray-500">
                      {formatMoney(currentActivity.hourly_rate)}/u
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span>Kies een activiteit</span>
            )}
          </span>
          <span className="p-2 -mr-2 -my-2 rounded hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-400 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[280px] max-h-60 overflow-y-auto">
            {activities.map((activity) => {
              const isActive = currentActivity?.activity_type === activity.name;
              const displayRate =
                activity.effective_hourly_rate ?? activity.hourly_rate;
              return (
                <div key={activity.id}>
                  {activity.id !== activities[0]?.id && (
                    <div className="h-px bg-gray-200" />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleSwitchActivity(activity.name, displayRate ?? null)
                    }
                    disabled={switching || isActive}
                    className={`w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center gap-2 ${
                      isActive ? "bg-blue-50" : ""
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-lg">{getActivityIcon(activity)}</span>
                    <span className="flex-1">{activity.name}</span>
                    {displayRate != null && displayRate !== "" && (
                      <span className="text-sm text-gray-500">
                        {formatMoney(displayRate)}/u
                      </span>
                    )}
                    {isActive && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-blue-600"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Breakdown Toggle */}
      {timerActivities.length > 0 && (
        <button
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
              Breakdown tonen
            </>
          )}
        </button>
      )}

      {/* Activity Breakdown (Expanded) */}
      {isExpanded && timerActivities.length > 0 && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {timerActivities.map((activity) => {
            const earnings = calculateActivityEarnings(activity);
            const isActive = !activity.end_time;
            return (
              <div
                key={activity.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <span className="font-medium">{activity.activity_type}</span>
                  <span className="text-gray-500">
                    {new Date(activity.start_time).toLocaleTimeString("nl-NL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {activity.end_time ? (
                      <>
                        {" - "}
                        {new Date(activity.end_time).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    ) : (
                      <span className="ml-1 text-green-600">(Actief)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">
                    {formatDuration(
                      activity.duration_ms ||
                        (isActive
                          ? new Date().getTime() -
                            new Date(activity.start_time).getTime()
                          : 0)
                    )}
                  </span>
                  {earnings > 0 && (
                    <span className="font-medium">{formatMoney(earnings)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

