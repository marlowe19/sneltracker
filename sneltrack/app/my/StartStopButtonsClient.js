"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/stores/useStore";

export default function StartStopButtonsClient({ user, active, onStopClick }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const projects = useStore((state) => state.projects);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [projectActivities, setProjectActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Pre-select default project when projects are loaded
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const defaultProject = projects.find((p) => p.is_default);
      if (defaultProject) {
        setSelectedProjectId(defaultProject.id);
      }
    }
  }, [projects, selectedProjectId]);

  // Fetch activities when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectActivities(selectedProjectId);
    } else {
      setProjectActivities([]);
      setSelectedActivity(null);
    }
  }, [selectedProjectId]);

  async function fetchProjectActivities(projectId) {
    setLoadingActivities(true);
    try {
      const res = await fetch(`/my/projects/${projectId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setProjectActivities(data.activities || []);
      } else {
        setProjectActivities([]);
      }
    } catch (error) {
      console.error("Error fetching project activities:", error);
      setProjectActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }

  async function handle(action) {
    setIsLoading(true);

    // If stopping, immediately notify parent to freeze counters
    if (action === "stop" && onStopClick) {
      onStopClick(new Date().toISOString());
    }

    try {
      const url = new URL(`/my/${action}`, window.location.origin);
      if (action === "start") {
        if (selectedProjectId) {
          url.searchParams.set("project", selectedProjectId);
        }
        if (selectedActivity) {
          url.searchParams.set("activity_type", selectedActivity.name);
          if (selectedActivity.hourly_rate) {
            url.searchParams.set(
              "activity_hourly_rate",
              selectedActivity.hourly_rate.toString()
            );
          }
        }
      }
      await fetch(url.toString(), { method: "POST" });
    } finally {
      setIsLoading(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {projects.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowProjectSelect(!showProjectSelect)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-gray-700">
              {selectedProjectId
                ? projects.find((p) => p.id === selectedProjectId)?.name ||
                  "Selecteer project"
                : "Selecteer project (optioneel)"}
            </span>
            <span className="text-gray-400">▼</span>
          </button>
          {showProjectSelect && (
            <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId("");
                  setShowProjectSelect(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 text-gray-700"
              >
                Kies project
              </button>
              {projects
                .filter(
                  (project) =>
                    project.status !== "archived" && project.archived !== true
                )
                .map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowProjectSelect(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-100 ${
                      selectedProjectId === project.id
                        ? "bg-blue-50 text-blue-900"
                        : "text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{project.name}</span>
                      <div className="flex items-center gap-2">
                        {project.is_default && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Standaard
                          </span>
                        )}
                        {project.is_shared && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            Gedeeld
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Selector - only show if project has activities and not active */}
      {!active &&
        selectedProjectId &&
        projectActivities.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Activiteit (optioneel)</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  !selectedActivity
                    ? "bg-[#008eff] text-white border-[#008eff]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Geen
              </button>
              {projectActivities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => setSelectedActivity(activity)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    selectedActivity?.id === activity.id
                      ? "bg-[#008eff] text-white border-[#008eff]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {activity.name}
                  {activity.hourly_rate && (
                    <span className="ml-1 text-xs">
                      (€{parseFloat(activity.hourly_rate).toFixed(2)}/uur)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

      <button
        type="button"
        onClick={() => handle(active ? "stop" : "start")}
        className={`btn w-full text-base sm:text-lg py-4 rounded-xl disabled:opacity-60 ${
          active ? "btn-secondary" : "bg-[#008eff]"
        }`}
        disabled={isLoading || isPending}
      >
        {active ? (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
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
            <span>Stop</span>
          </>
        ) : (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
            </svg>
            <span>Start</span>
          </>
        )}
      </button>
    </div>
  );
}
