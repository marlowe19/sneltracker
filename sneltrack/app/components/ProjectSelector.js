"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/stores/useStore";

export default function ProjectSelector({
  selectedProjectId = "",
  onProjectChange,
  placeholder = "Selecteer project (optioneel)",
  emptyPlaceholder = "Geen project",
  className = "",
  user = null,
}) {
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const containerRef = useRef(null);
  const projects = useStore((state) => state.projects);
  const fetchProjects = useStore((state) => state.fetchProjects);

  // Fetch projects if not loaded
  useEffect(() => {
    if (projects.length === 0 && user) {
      fetchProjects(user);
    }
  }, [projects.length, user, fetchProjects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showProjectSelect &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowProjectSelect(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProjectSelect]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleSelectProject = (projectId) => {
    if (onProjectChange) {
      onProjectChange(projectId);
    }
    setShowProjectSelect(false);
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setShowProjectSelect(!showProjectSelect)}
        className="w-full py-2 text-base text-gray-700 flex items-center gap-2"
      >
        <span className="flex items-center gap-1.5 flex-1 text-left">
          {selectedProject ? (
            <>
              <span>{selectedProject.name}</span>
              <div className="flex items-center gap-1.5">
                {selectedProject.is_default && (
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
                {selectedProject.is_shared && (
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
            </>
          ) : (
            <span>{placeholder}</span>
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
              showProjectSelect ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {showProjectSelect && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[280px] max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleSelectProject(null)}
            className="w-full px-3 py-2 text-base text-left hover:bg-gray-100 text-gray-700 flex items-center"
          >
            {emptyPlaceholder}
          </button>
          {projects.map((project) => (
            <div key={project.id}>
              <div className="h-px bg-gray-200" />
              <button
                type="button"
                onClick={() => handleSelectProject(project.id)}
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
  );
}

