"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProjectFormClient from "./ProjectFormClient";
import { useStore } from "@/stores/useStore";
import { useToast } from "@/app/components/Toast";

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
  const toast = useToast();

  // Use projects from store, fallback to initialProjects if store is empty
  const displayProjects =
    projects.length > 0 ? projects : initialProjects || [];

  function handleCreate() {
    setEditingProject(null);
    setIsFormOpen(true);
  }

  function handleProjectClick(project) {
    // Check if shared project and user is not owner
    if (project.is_shared && project.owner !== user) {
      toast.show("alleen de eigenaar heeft toegang tot het project");
      return;
    }
    // Navigate to detail page
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

                  {(() => {
                    let rate = null;
                    if (project.is_shared) {
                      const isOwner = project.owner === user;
                      if (isOwner) {
                        // Owner can see project rate or member rate
                        rate =
                          project.member_hourly_rate ?? project.hourly_rate;
                      } else {
                        // Non-owner: only show their member rate, never project rate
                        rate = project.member_hourly_rate ?? 0;
                      }
                    } else {
                      // User project: show project rate
                      rate = project.hourly_rate;
                    }
                    return rate !== null && rate !== undefined && rate !== 0 ? (
                      <div className="text-sm text-gray-600 mb-2">
                        Mijn Tarief: {formatMoney(rate)}/uur
                      </div>
                    ) : null;
                  })()}
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
