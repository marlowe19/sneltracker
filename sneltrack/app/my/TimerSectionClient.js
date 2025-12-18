"use client";

import { useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/stores/useStore";
import RunningClockClient from "./RunningClockClient";
import MoneyCounterClient from "./MoneyCounterClient";
import { computeEntryDurationMs } from "@/lib/time";
import { formatHM } from "@/lib/time";

export default function TimerSectionClient({ user }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  function handleProjectChange(entryId, newProjectId) {
    closeDropdown(entryId);
    if (entryId.startsWith("pending-")) {
      // Update pending timer
      updatePendingTimer(entryId, { projectId: newProjectId });
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
      await fetch(url.toString(), { method: "POST" });
      // Remove from pending
      removePendingTimer(timer.id);
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
          end_time: data.endedAt || stopTime,
          is_running: false,
          duration_ms: data.durationMs || null,
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
                {projects.map((project, index) => (
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

          {/* Timer and Money */}
          <div className="flex flex-col items-start">
            <div className="text-3xl font-semibold">
              <RunningClockClient
                startedAt={entry?.start_time || null}
                stoppedAt={stoppedAt}
              />
            </div>
            {entry?.hourly_rate && (
              <div className="mt-1 text-base font-semibold text-gray-700">
                <MoneyCounterClient
                  startedAt={entry.start_time}
                  hourlyRate={entry.hourly_rate}
                  stoppedAt={stoppedAt}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right column: Play/Stop button */}
        <div className="flex items-center justify-center shrink-0 pl-4 self-center">
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
    const totalMoney =
      entry.hourly_rate && durationMs > 0
        ? (durationMs / (1000 * 60 * 60)) * entry.hourly_rate
        : 0;

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
