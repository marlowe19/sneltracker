"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StartStopButtonsClient({ user, active, onStopClick }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showProjectSelect, setShowProjectSelect] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`);
        const data = await res.json();
        setProjects(data.projects || []);
        // Pre-select default project if available
        const defaultProject = data.projects?.find((p) => p.is_default);
        if (defaultProject) {
          setSelectedProjectId(defaultProject.id);
        }
      } catch (error) {
        console.error("Error loading projects:", error);
      }
    }
    loadProjects();
  }, [user]);

  async function handle(action) {
    setIsLoading(true);

    // If stopping, immediately notify parent to freeze counters
    if (action === "stop" && onStopClick) {
      onStopClick(new Date().toISOString());
    }

    try {
      const url = new URL(
        `/${encodeURIComponent(user)}/${action}`,
        window.location.origin
      );
      if (action === "start" && selectedProjectId) {
        url.searchParams.set("project", selectedProjectId);
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
                Geen project
              </button>
              {projects.map((project) => (
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
                  {project.name}
                  {project.is_default && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Standaard)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
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
