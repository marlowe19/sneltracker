"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProjectFormClient from "./ProjectFormClient";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(totalHours) {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export default function ProjectsListClient({ user, initialProjects }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [isPending, startTransition] = useTransition();
  const [editingProject, setEditingProject] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statistics, setStatistics] = useState({});
  const [copiedProjectId, setCopiedProjectId] = useState(null);

  async function loadProjects() {
    try {
      const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }

  async function loadStatistics(projectId) {
    try {
      const res = await fetch(
        `/${encodeURIComponent(
          user
        )}/projecten/api?projectId=${projectId}&stats=true`
      );
      const data = await res.json();
      setStatistics((prev) => ({ ...prev, [projectId]: data.statistics }));
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }

  function handleCreate() {
    setEditingProject(null);
    setIsFormOpen(true);
  }

  function handleProjectClick(project) {
    setEditingProject(project);
    setIsFormOpen(true);
  }

  async function handleDelete(projectId) {
    try {
      const res = await fetch(
        `/${encodeURIComponent(user)}/projecten/api?id=${projectId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setIsFormOpen(false);
        setEditingProject(null);
        startTransition(() => {
          router.refresh();
          loadProjects();
        });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project");
    }
  }

  function handleFormClose() {
    setIsFormOpen(false);
    setEditingProject(null);
    startTransition(() => {
      router.refresh();
      loadProjects();
    });
  }

  async function handleCopyLink(e, projectId) {
    e.stopPropagation(); // Prevent triggering project edit modal

    const url = new URL(
      `/${encodeURIComponent(user)}/start`,
      window.location.origin
    );
    url.searchParams.set("project", projectId);

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedProjectId(projectId);
      // Clear the "copied" state after 2 seconds
      setTimeout(() => setCopiedProjectId(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      alert("Kon URL niet kopiëren. Probeer het opnieuw.");
    }
  }

  // Load statistics for all projects on mount
  useEffect(() => {
    projects.forEach((project) => {
      loadStatistics(project.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {projects.length} {projects.length === 1 ? "project" : "projecten"}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="btn px-4 py-2 text-sm rounded-lg bg-[#008eff] text-white"
        >
          + Nieuw Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nog geen projecten. Maak je eerste project aan!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const stats = statistics[project.id];
            return (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className="border border-[#ffa540] bg-[#fff9e5] rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      {project.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Standaard
                        </span>
                      )}
                    </div>

                    {project.hourly_rate && (
                      <div className="text-sm text-gray-600 mb-2">
                        Tarief: {formatMoney(project.hourly_rate)}/uur
                      </div>
                    )}

                    {stats && stats.budgetHours && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>
                            {stats.totalHours.toFixed(1)} / {stats.budgetHours}{" "}
                            uren
                          </span>
                          <span
                            className={
                              stats.isOverBudget
                                ? "text-red-600 font-semibold"
                                : "text-gray-600"
                            }
                          >
                            {stats.budgetPercentage !== null
                              ? `${stats.budgetPercentage.toFixed(1)}%`
                              : "-"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${
                              stats.isOverBudget
                                ? "bg-red-500"
                                : stats.budgetPercentage > 80
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{
                              width: `${
                                stats.budgetPercentage !== null
                                  ? Math.min(stats.budgetPercentage, 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        {stats.isOverBudget && stats.budgetPercentage !== null && (
                          <div className="w-full bg-red-200 rounded-full h-2.5 -mt-2.5">
                            <div
                              className="h-2.5 rounded-full bg-red-600"
                              style={{
                                width: `${stats.budgetPercentage - 100}%`,
                                marginLeft: "100%",
                              }}
                            />
                          </div>
                        )}
                        {stats.budgetPrice !== null && project.hourly_rate && (
                          <div className="text-xs text-gray-500 mt-1">
                            Budget: {formatMoney(stats.budgetPrice)} | Actueel:{" "}
                            {formatMoney(stats.totalMoney)}
                            {stats.isOverBudget && (
                              <span className="text-red-600 ml-1">
                                (+
                                {formatMoney(
                                  stats.totalMoney - stats.budgetPrice
                                )})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {stats && stats.entryCount > 0 && !stats.budgetHours && (
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        <div>
                          Tijd: {formatHours(stats.totalHours)} (
                          {stats.entryCount}{" "}
                          {stats.entryCount === 1 ? "entry" : "entries"})
                        </div>
                        {stats.totalMoney > 0 && (
                          <div>Verdiend: {formatMoney(stats.totalMoney)}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(e, project.id)}
                    className="ml-2 p-2 text-gray-500 hover:text-[#008eff] hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                    title={
                      copiedProjectId === project.id
                        ? "Gekopieerd!"
                        : "Kopieer link"
                    }
                    aria-label="Kopieer project link"
                  >
                    {copiedProjectId === project.id ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-600"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <ProjectFormClient
          user={user}
          project={editingProject}
          onClose={handleFormClose}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
