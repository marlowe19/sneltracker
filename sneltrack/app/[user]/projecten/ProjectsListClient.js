"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProjectFormClient from "./ProjectFormClient";
import { useStore } from "@/stores/useStore";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ProjectsListClient({ user, initialProjects }) {
  const router = useRouter();
  const projects = useStore((state) => state.projects);
  const fetchProjects = useStore((state) => state.fetchProjects);
  const [isPending, startTransition] = useTransition();
  const [editingProject, setEditingProject] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [copiedProjectId, setCopiedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState("user"); // "user" or "shared"

  // Use projects from store, fallback to initialProjects if store is empty
  const displayProjects =
    projects.length > 0 ? projects : initialProjects || [];

  function handleCreate() {
    setEditingProject(null);
    setIsFormOpen(true);
  }

  function handleProjectClick(project) {
    // Navigate to detail page instead of opening modal
    router.push(`/${encodeURIComponent(user)}/projecten/${project.id}`);
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
        // Refresh projects from store
        fetchProjects(user);
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
    // Refresh projects from store
    fetchProjects(user);
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

  // Filter projects based on active tab
  const filteredProjects = displayProjects.filter((project) => {
    if (activeTab === "shared") {
      return project.is_shared === true;
    } else {
      return !project.is_shared;
    }
  });

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:bg-white bg-white">
        <button
          type="button"
          onClick={() => setActiveTab("user")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "user"
              ? "text-[#008eff] border-b-2 border-[#008eff]"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Mijn Projecten ({displayProjects.filter((p) => !p.is_shared).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("shared")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "shared"
              ? "text-[#008eff] border-b-2 border-[#008eff]"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Gedeelde Projecten (
          {displayProjects.filter((p) => p.is_shared).length})
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {filteredProjects.length}{" "}
          {filteredProjects.length === 1 ? "project" : "projecten"}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="btn px-4 py-2 text-sm rounded-lg bg-[#008eff] text-white"
        >
          + Nieuw Project
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nog geen projecten. Maak je eerste project aan!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((project) => {
            const isOwner = project.is_shared && project.owner === user;
            return (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className="border border-[#ffa540] bg-[#fff9e5] rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors overflow-hidden"
              >
                <div className="flex justify-end gap-1 mb-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProject(project);
                      setIsFormOpen(true);
                    }}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                    title="Bewerken"
                    aria-label="Bewerk project"
                  >
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
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyLink(e, project.id);
                    }}
                    className="p-2 text-gray-500 hover:text-[#008eff] hover:bg-gray-100 rounded-lg transition-colors shrink-0"
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
                <div className="flex-1 min-w-0">
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      {project.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Standaard
                        </span>
                      )}
                    </div>
                    {project.is_shared && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {isOwner ? "Eigenaar" : "Gedeeld"}
                        </span>
                      </div>
                    )}
                  </div>

                  {project.hourly_rate && (
                    <div className="text-sm text-gray-600 mb-2">
                      Tarief: {formatMoney(project.hourly_rate)}/uur
                    </div>
                  )}
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
