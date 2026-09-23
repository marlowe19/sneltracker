"use client";

import { useEffect, useTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/stores/useStore";
import RunningClockClient from "./RunningClockClient";
import TimerActivitySwitcher from "@/app/my/components/TimerActivitySwitcher";
import { computeEntryDurationMs } from "@/lib/time";
import { formatHM } from "@/lib/time";
import { Portfolio, Tag } from "@carbon/icons-react";
import {
  computeActivityBillableMoney,
  computeEntryBillableMoney,
  isBillable,
} from "@/lib/finance/entryEarnings";

function sortProjectActivitiesForPicker(rows) {
  return [...(rows || [])].sort(
    (a, b) =>
      (a.display_order ?? 0) - (b.display_order ?? 0) ||
      String(a.name || "").localeCompare(String(b.name || ""), "nl")
  );
}

/** User activities with no project row (by user_activity_id or same name). */
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

function selectionKey(sel) {
  if (!sel) return null;
  if (sel.kind === "project") return `project:${sel.projectActivityId}`;
  if (sel.kind === "user") return `user:${sel.id}`;
  if (sel.id) return `user:${sel.id}`;
  return null;
}

function projectActivityDisplayRate(pa) {
  if (pa == null) return null;
  const r = pa.effective_hourly_rate ?? pa.hourly_rate;
  return r != null && r !== "" ? r : null;
}

export default function TimerSectionClient({ user }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [entryActivities, setEntryActivities] = useState({}); // entryId -> { currentActivity: { activity_type, hourly_rate, start_time }, allActivities: [...] }
  const [now, setNow] = useState(() => Date.now()); // For real-time updates
  const [userActivities, setUserActivities] = useState([]);
  /** timerId -> { kind:'user'|'project', ... } | null */
  const [pendingActivityMap, setPendingActivityMap] = useState({});
  /** projectId -> { loading, loaded, activities } */
  const [projectActivitiesCache, setProjectActivitiesCache] = useState({});
  const activeEntries = useStore((state) => state.activeEntries);
  const stoppedTimersList = useStore((state) => state.stoppedTimers);
  const projects = useStore((state) => state.projects);
  const openDropdowns = useStore((state) => state.openDropdowns);
  const stoppedTimers = useStore((state) => state.stoppedTimers);
  const pendingTimers = useStore((state) => state.pendingTimers);
  const toggleDropdown = useStore((state) => state.toggleDropdown);
  const closeDropdown = useStore((state) => state.closeDropdown);
  const setStoppedTimer = useStore((state) => state.setStoppedTimer);
  const removePendingTimer = useStore((state) => state.removePendingTimer);
  const updatePendingTimer = useStore((state) => state.updatePendingTimer);
  const addEntry = useStore((state) => state.addEntry);
  const updateActiveEntries = useStore((state) => state.updateActiveEntries);
  const dropdownRefs = useRef({}); // timerId -> ref

  // Click outside handler to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      Object.keys(openDropdowns).forEach((timerId) => {
        if (openDropdowns[timerId] && dropdownRefs.current[timerId]) {
          if (!dropdownRefs.current[timerId].contains(event.target)) {
            closeDropdown(timerId);
          }
        }
      });
    }

    if (Object.values(openDropdowns).some(Boolean)) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [openDropdowns, closeDropdown]);

  // Fetch user-level activities for activity selection on pending timers
  useEffect(() => {
    fetch("/my/api/activities", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { activities: [] }))
      .then((d) => setUserActivities(d.activities || []))
      .catch(() => setUserActivities([]));
  }, []);

  useEffect(() => {
    const projectIds = [
      ...new Set([
        ...pendingTimers.map((t) => t.projectId).filter(Boolean),
        ...activeEntries.map((e) => e.project_id).filter(Boolean),
      ]),
    ];
    projectIds.forEach((projectId) => {
      setProjectActivitiesCache((prev) => {
        const cur = prev[projectId];
        if (cur?.loaded || cur?.loading) return prev;
        return {
          ...prev,
          [projectId]: { loading: true, loaded: false, activities: [] },
        };
      });

      fetch(`/my/projects/${projectId}/activities`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { activities: [] }))
        .then((d) => {
          setProjectActivitiesCache((prev) => ({
            ...prev,
            [projectId]: {
              loading: false,
              loaded: true,
              activities: d.activities || [],
            },
          }));
        })
        .catch(() => {
          setProjectActivitiesCache((prev) => ({
            ...prev,
            [projectId]: { loading: false, loaded: true, activities: [] },
          }));
        });
    });
  }, [pendingTimers, activeEntries]);

  // Real-time update effect for cumulative earnings calculation
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Function to fetch activities for a specific entry
  const fetchEntryActivities = async (entryId) => {
    try {
      const res = await fetch(`/my/entries/${entryId}/activities`);
      if (res.ok) {
        const data = await res.json();
        const allActivities = data.activities || [];
        const active = allActivities.find((a) => !a.end_time);

        return {
          currentActivity: active
            ? {
                activity_type: active.activity_type,
                hourly_rate: active.hourly_rate,
                start_time: active.start_time,
              }
            : null,
          allActivities: allActivities,
        };
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
    return null;
  };

  // Fetch all activities for active entries
  useEffect(() => {
    async function fetchCurrentActivities() {
      const activitiesMap = {};

      for (const entry of activeEntries) {
        const activitiesData = await fetchEntryActivities(entry.id);
        if (activitiesData) {
          activitiesMap[entry.id] = activitiesData;
        }
      }

      setEntryActivities(activitiesMap);
    }

    if (activeEntries.length > 0) {
      fetchCurrentActivities();
    } else {
      // Clear activities when no active entries
      setEntryActivities({});
    }
  }, [activeEntries]);

  // Function to refresh activities for a specific entry (called after activity switch)
  const refreshEntryActivities = async (entryId) => {
    const activitiesData = await fetchEntryActivities(entryId);
    if (activitiesData) {
      setEntryActivities((prev) => ({
        ...prev,
        [entryId]: activitiesData,
      }));
    }
  };

  function handleProjectChange(entryId, newProjectId) {
    closeDropdown(entryId);
    if (entryId.startsWith("pending-")) {
      updatePendingTimer(entryId, { projectId: newProjectId });
      setPendingActivityMap((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    } else {
      // Update active entry
      async function updateEntryProject() {
        try {
          const res = await fetch(`/my/entries/${entryId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project: newProjectId || null }),
          });
          if (res.ok) {
            startTransition(() => router.refresh());
          }
        } catch (error) {
          console.error("Error updating entry project:", error);
        }
      }
      updateEntryProject();
    }
  }

  async function handleStart(timer) {
    try {
      const url = new URL(`/my/start`, window.location.origin);
      if (timer.projectId) {
        url.searchParams.set("project", timer.projectId);
      }
      const selectedActivity = pendingActivityMap[timer.id];
      if (selectedActivity) {
        if (selectedActivity.kind === "project") {
          if (selectedActivity.user_activity_id) {
            url.searchParams.set(
              "activity_id",
              selectedActivity.user_activity_id
            );
          } else {
            url.searchParams.set("activity_type", selectedActivity.name);
          }
        } else {
          url.searchParams.set("activity_id", selectedActivity.id);
        }
      }
      await fetch(url.toString(), { method: "POST" });
      removePendingTimer(timer.id);
      setPendingActivityMap((prev) => {
        const next = { ...prev };
        delete next[timer.id];
        return next;
      });
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  }

  async function handleStop(entry) {
    const stopTime = new Date().toISOString();
    setStoppedTimer(entry.id, stopTime);
    try {
      const response = await fetch(`/my/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      });

      if (response.ok) {
        const data = await response.json();
        // The stopped entry is now in the database with end_time set
        // Create a stopped entry object from the current entry + stop time
        const stoppedEntry = {
          ...entry,
          end_time: data.entry?.end_time || data.endedAt || stopTime,
          is_running: false,
          duration_ms: data.entry?.duration_ms ?? data.durationMs ?? null,
          break_deduction_ms: data.entry?.break_deduction_ms ?? null,
        };

        // Add to entries store immediately so it appears in day modal
        addEntry(stoppedEntry);

        // Remove from activeEntries immediately
        updateActiveEntries(activeEntries.filter((e) => e.id !== entry.id));
      }

      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Error stopping timer:", error);
    }
  }

  // Calculate cumulative earnings from all activities
  function calculateCumulativeEarnings(
    activities,
    currentActivity,
    currentTime
  ) {
    let total = 0;

    // Sum earnings from completed billable activities
    activities.forEach((activity) => {
      if (activity.end_time) {
        total += computeActivityBillableMoney(activity, currentTime);
      }
    });

    // Add current activity earnings (will be 0 if rate is 0 or not billable)
    if (currentActivity && currentActivity.start_time) {
      total += computeActivityBillableMoney(currentActivity, currentTime);
    }

    return total;
  }

  const allTimers = [
    ...activeEntries.map((entry) => ({ type: "active", data: entry })),
    ...pendingTimers.map((timer) => ({ type: "pending", data: timer })),
  ];

  const renderTimer = (timer) => {
    const entry = timer.type === "active" ? timer.data : null;
    const pending = timer.type === "pending" ? timer.data : null;
    const timerId = entry?.id || pending?.id;
    const isPendingTimer = timer.type === "pending";
    const stoppedAt = stoppedTimers[timerId];
    const pendingProjectId = pending?.projectId || null;
    const paCache = pendingProjectId
      ? projectActivitiesCache[pendingProjectId]
      : null;
    const projectActivitiesSorted = pendingProjectId
      ? sortProjectActivitiesForPicker(paCache?.activities || [])
      : [];
    const projectActivityListReady = !pendingProjectId || paCache?.loaded;
    const profileExtraActivities = pendingProjectId
      ? projectActivityListReady
        ? getProfileActivitiesNotOnProject(
            projectActivitiesSorted,
            userActivities
          )
        : []
      : userActivities;
    const projectActivityListLoading =
      Boolean(pendingProjectId) && !paCache?.loaded;
    const showPendingActivityPicker =
      isPendingTimer &&
      Boolean(pendingProjectId || userActivities.length > 0);

    // Get activities data
    const activitiesData = entryActivities[entry?.id];
    const currentActivity = activitiesData?.currentActivity;
    const allActivities = activitiesData?.allActivities || [];
    const currentActivityName = currentActivity?.activity_type;

    // Calculate cumulative earnings
    const currentTime = stoppedAt ? new Date(stoppedAt).getTime() : now;
    let cumulativeEarnings = 0;

    if (allActivities.length > 0) {
      // Calculate from activities
      cumulativeEarnings = calculateCumulativeEarnings(
        allActivities,
        currentActivity,
        currentTime
      );
    } else if (
      isBillable(entry?.billable) &&
      entry?.hourly_rate &&
      entry?.start_time
    ) {
      // Fallback to entry rate if no activities
      cumulativeEarnings = computeEntryBillableMoney(
        entry,
        currentTime - new Date(entry.start_time).getTime()
      );
    }

    // Format money
    const formattedMoney =
      cumulativeEarnings > 0
        ? new Intl.NumberFormat("nl-NL", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(cumulativeEarnings)
        : null;

    return (
      <div
        key={timerId}
        className="timer-box flex flex-row items-center pl-4 pr-4 pt-2 pb-2 rounded-lg mb-4 bg-white border border-snelgray"
      >
        {/* Left column: Project selector and counter */}
        <div className="flex flex-col flex-1">
          <div
            ref={(el) => {
              dropdownRefs.current[timerId] = el;
            }}
            className="relative"
          >
            <button
              type="button"
              onClick={() => toggleDropdown(timerId)}
              className=" py-2 text-base text-gray-700 flex items-center gap-2 min-w-[200px]"
            >
              <Portfolio size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
              <span className="flex items-center gap-1.5 flex-1 text-left">
                {(() => {
                  // Use project_id (Supabase UUID) to find project, fallback to project (Firestore ID)
                  const selectedProjectId =
                    entry?.project_id ||
                    entry?.project ||
                    pending?.projectId ||
                    "";
                  const selectedProject = projects.find(
                    (p) => p.id === selectedProjectId
                  );

                  // Use project_name from entry if available (from API), otherwise use project name from store
                  const projectName =
                    entry?.project_name || selectedProject?.name;
                  const isDefault = selectedProject?.is_default || false;
                  const isShared =
                    entry?.isProjectOwner ||
                    entry?.isProjectMember ||
                    selectedProject?.is_shared ||
                    false;

                  return (
                    <>
                      {projectName ? (
                        <>
                          <span>{projectName}</span>
                          {isDefault && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="text-yellow-500"
                              aria-hidden="true"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                          {isShared && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-blue-500"
                              aria-hidden="true"
                            >
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          )}
                        </>
                      ) : (
                        <span>Geen project</span>
                      )}
                    </>
                  );
                })()}
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
                    openDropdowns[timerId] ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            {openDropdowns[timerId] && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[280px] max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    // Dummy action - will be replaced with server call later
                    handleProjectChange(timerId, null);
                  }}
                  className="w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center"
                >
                  Kies een project
                </button>
                {projects
                  .filter(
                    (project) =>
                      project.status !== "archived" && project.archived !== true
                  )
                  .map((project, index) => (
                    <div key={project.id}>
                      <div className="h-px bg-gray-200" />
                      <button
                        type="button"
                        onClick={() => {
                          // Dummy action - will be replaced with server call later
                          handleProjectChange(timerId, project.id);
                        }}
                        className="w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center gap-2"
                      >
                        <span className="flex-1">{project.name}</span>
                        <div className="flex items-center gap-1.5">
                          {project.is_default && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="text-yellow-500"
                              aria-hidden="true"
                              title="Standaard"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                          {project.is_shared && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-blue-500"
                              aria-hidden="true"
                              title="Gedeeld"
                            >
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Activity dropdown: with project → project activities + profile extras; else profile only */}
          {showPendingActivityPicker && (
            <div
              ref={(el) => {
                dropdownRefs.current[`${timerId}-activity`] = el;
              }}
              className="relative"
            >
              <button
                type="button"
                onClick={() => toggleDropdown(`${timerId}-activity`)}
                className="py-2 text-base text-gray-700 flex items-center gap-2 min-w-[200px]"
              >
                <Tag size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">
                  {projectActivityListLoading
                    ? "Activiteiten laden…"
                    : pendingActivityMap[timerId]
                      ? pendingActivityMap[timerId].name
                      : "Kies een activiteit (optioneel)"}
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
                      openDropdowns[`${timerId}-activity`] ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {openDropdowns[`${timerId}-activity`] && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[280px] max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingActivityMap((prev) => ({
                        ...prev,
                        [timerId]: null,
                      }));
                      closeDropdown(`${timerId}-activity`);
                    }}
                    className="w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center"
                  >
                    Geen activiteit
                  </button>
                  {projectActivityListLoading && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Laden…
                    </div>
                  )}
                  {pendingProjectId &&
                    projectActivityListReady &&
                    projectActivitiesSorted.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Project
                        </div>
                        {projectActivitiesSorted.map((pa) => (
                          <div key={pa.id}>
                            <div className="h-px bg-gray-200" />
                            <button
                              type="button"
                              onClick={() => {
                                setPendingActivityMap((prev) => ({
                                  ...prev,
                                  [timerId]: {
                                    kind: "project",
                                    projectActivityId: pa.id,
                                    name: pa.name,
                                    hourly_rate: projectActivityDisplayRate(pa),
                                    user_activity_id: pa.user_activity_id,
                                  },
                                }));
                                closeDropdown(`${timerId}-activity`);
                              }}
                              className={`w-full px-3 py-2 text-base text-left hover:bg-gray-100 flex items-center justify-between ${
                                selectionKey(pendingActivityMap[timerId]) ===
                                `project:${pa.id}`
                                  ? "bg-blue-50 text-blue-900"
                                  : "text-gray-700"
                              }`}
                            >
                              <span>{pa.name}</span>
                              {projectActivityDisplayRate(pa) != null && (
                                <span className="text-sm text-gray-500 shrink-0 ml-2">
                                  €
                                  {parseFloat(
                                    projectActivityDisplayRate(pa)
                                  ).toFixed(2)}
                                  /uur
                                </span>
                              )}
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  {profileExtraActivities.length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {pendingProjectId ? "Profiel" : "Activiteiten"}
                      </div>
                      {profileExtraActivities.map((act) => (
                        <div key={act.id}>
                          <div className="h-px bg-gray-200" />
                          <button
                            type="button"
                            onClick={() => {
                              setPendingActivityMap((prev) => ({
                                ...prev,
                                [timerId]: {
                                  kind: "user",
                                  id: act.id,
                                  name: act.name,
                                  hourly_rate: act.hourly_rate,
                                },
                              }));
                              closeDropdown(`${timerId}-activity`);
                            }}
                            className={`w-full px-3 py-2 text-base text-left hover:bg-gray-100 flex items-center justify-between ${
                              selectionKey(pendingActivityMap[timerId]) ===
                              `user:${act.id}`
                                ? "bg-blue-50 text-blue-900"
                                : "text-gray-700"
                            }`}
                          >
                            <span>{act.name}</span>
                            {act.hourly_rate != null && (
                              <span className="text-sm text-gray-500 shrink-0 ml-2">
                                €{parseFloat(act.hourly_rate).toFixed(2)}/uur
                              </span>
                            )}
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timer and Money */}
          <div className="flex flex-col items-start">
            <div className="text-3xl font-semibold">
              <RunningClockClient
                startedAt={entry?.start_time || null}
                stoppedAt={stoppedAt}
              />
            </div>
            {currentActivityName && (
              <div className="mt-1 text-sm text-gray-600 font-medium">
                {currentActivityName}
              </div>
            )}
            {formattedMoney && (
              <div className="mt-1 text-base font-semibold text-gray-700">
                <span className="money-text">{formattedMoney}</span>
              </div>
            )}
          </div>

          {/* Activity switcher + breakdown for running timers */}
          {!isPendingTimer && entry && (
            <TimerActivitySwitcher
              entryId={entry.id}
              projectId={entry.project_id || null}
              userActivities={userActivities}
              onActivitySwitched={() => refreshEntryActivities(entry.id)}
              currentTime={now}
            />
          )}
        </div>

        {/* Right column: Play/Stop button */}
        <div className="flex items-start justify-center shrink-0 pl-4">
          {isPendingTimer ? (
            <button
              type="button"
              onClick={() => handleStart(pending)}
              className="w-12 h-12 rounded-full bg-[#E5F5F4] hover:bg-green-600 active:bg-green-700 flex items-center justify-center transition-colors shrink-0"
              aria-label="Start timer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{ color: "#40A69F" }}
              >
                <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStop(entry)}
              disabled={isPending}
              className="w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 flex items-center justify-center disabled:opacity-60 transition-colors shrink-0"
              aria-label="Stop timer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-white"
              >
                <rect
                  x="7"
                  y="7"
                  width="10"
                  height="10"
                  rx="2"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderStoppedTimer = (entry) => {
    const durationMs = computeEntryDurationMs(
      entry.start_time,
      entry.end_time,
      entry.duration_ms
    );
    const formattedDuration = formatHM(durationMs);
    const [hours, minutes] = formattedDuration.split(":");
    const totalMoney = computeEntryBillableMoney(entry, durationMs);

    // Use project_id (Supabase UUID) to find project, fallback to project (Firestore ID)
    const selectedProject = projects.find(
      (p) => p.id === entry.project_id || p.id === entry.project
    );

    // Use project_name from entry if available (from API), otherwise use project name from store
    const projectName = entry?.project_name || selectedProject?.name;
    const isDefault = selectedProject?.is_default || false;
    const isShared =
      entry?.isProjectOwner ||
      entry?.isProjectMember ||
      selectedProject?.is_shared ||
      false;

    return (
      <div
        key={entry.id}
        className="timer-box flex flex-col items-start mb-4 bg-white opacity-75"
      >
        {/* Top: Project name (read-only) */}
        <div className="flex items-center justify-between w-full">
          <div className="py-2 text-base text-gray-700 flex items-center gap-2 min-w-[200px]">
            <span className="flex items-center gap-1.5 flex-1 text-left">
              {projectName ? (
                <>
                  <span>{projectName}</span>
                  {isDefault && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-yellow-500"
                      aria-hidden="true"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  )}
                  {isShared && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-500"
                      aria-hidden="true"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  )}
                </>
              ) : (
                <span>Geen project</span>
              )}
            </span>
          </div>
        </div>

        {/* Bottom: Final time and money */}
        <div className="flex flex-col items-start w-full">
          <div className="text-3xl font-semibold">
            <span className="timer-text">
              <span>{hours}</span>
              <span className="timer-colon">:</span>
              <span>{minutes}</span>
            </span>
          </div>
          {entry.hourly_rate && totalMoney > 0 && (
            <div className="mt-1 text-base font-semibold text-gray-700">
              €{totalMoney.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-2">
      {/* Active Timer list */}
      {allTimers.length === 0 && stoppedTimersList.length === 0 ? (
        <div className="text-center text-gray-500 py-8"></div>
      ) : (
        <>
          {allTimers.length > 0 && (
            <>{allTimers.map((timer) => renderTimer(timer))}</>
          )}

          {/* {stoppedTimersList.length > 0 && (
            <>
              <div className="my-6 border-t border-gray-300"></div>
              <div className="text-sm font-medium text-gray-500 mb-3 px-4">
                Recente timers
              </div>
              {stoppedTimersList.map((entry) => renderStoppedTimer(entry))}
            </>
          )} */}
        </>
      )}
    </div>
  );
}
