"use client";

import { useState, useEffect } from "react";
import MembersListClient from "./MembersListClient";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ProjectFormClient({
  user,
  project,
  onClose,
  onDelete,
}) {
  const [name, setName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [budgetHours, setBudgetHours] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setHourlyRate(project.hourly_rate ? String(project.hourly_rate) : "");
      setBudgetHours(project.budget_hours ? String(project.budget_hours) : "");
      setIsDefault(project.is_default || false);
      setIsShared(project.is_shared || false);
      setIsOwner(project.is_shared && project.owner === user);
      // Load statistics for existing project
      if (project.id) {
        loadStatistics(project.id);
        if (project.is_shared) {
          loadMembers(project.id);
        }
      }
    } else {
      setStats(null);
      setIsShared(false);
      setIsOwner(false);
      setMembers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.is_shared, user]);

  async function loadStatistics(projectId) {
    if (!projectId) return;
    try {
      const res = await fetch(
        `/${encodeURIComponent(
          user
        )}/projecten/api?projectId=${projectId}&stats=true`
      );
      const data = await res.json();
      setStats(data.statistics);
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }

  async function loadMembers(projectId) {
    if (!projectId) return;
    try {
      const res = await fetch(
        `/${encodeURIComponent(
          user
        )}/projecten/api?action=members&projectId=${projectId}`
      );
      const data = await res.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error("Error loading members:", error);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const body = {
        name: name.trim(),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        budget_hours: budgetHours ? parseFloat(budgetHours) : null,
        is_default: isDefault,
        is_shared: isShared,
      };

      if (project) {
        // Update existing project
        body.id = project.id;
        const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update project");
        }
      } else {
        // Create new project
        const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create project");
        }
      }

      onClose();
    } catch (err) {
      setError(err.message || "An error occurred");
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!project || !onDelete) return;

    if (!confirm("Weet je zeker dat je dit project wilt verwijderen?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(project.id);
    } catch (err) {
      setError(err.message || "Failed to delete project");
      setIsDeleting(false);
    }
  }

  async function handleConvertToShared() {
    if (!project || project.is_shared) return;

    if (
      !confirm(
        "Weet je zeker dat je dit project wilt delen? Alle tijdentries worden gemigreerd."
      )
    ) {
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      const res = await fetch(
        `/${encodeURIComponent(user)}/projecten/api?action=convertToShared`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to convert project");
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to convert project");
      setIsConverting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {project ? "Project bewerken" : "Nieuw Project"}
            </h3>
            <div className="flex items-center gap-2">
              {project && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-red-400 hover:text-red-600 p-1"
                  aria-label="Delete project"
                  disabled={isSaving || isDeleting}
                  title="Verwijderen"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
                disabled={isSaving || isDeleting}
              >
                ✕
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Projectnaam *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
                placeholder="Projectnaam"
              />
            </div>

            {(isOwner || !project?.is_shared) && (
              <div>
                <label
                  htmlFor="hourlyRate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Uurtarief (EUR)
                </label>
                <input
                  type="number"
                  id="hourlyRate"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  step="0.01"
                  min="0"
                  disabled={project?.is_shared && !isOwner}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed text-base"
                  placeholder="0.00"
                />
              </div>
            )}

            {project?.is_shared && !isOwner && project.hourly_rate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uurtarief (EUR)
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                  {formatMoney(project.hourly_rate)}/uur
                </div>
              </div>
            )}

            {(isOwner || !project?.is_shared) && (
              <div>
                <label
                  htmlFor="budgetHours"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Begroting (uren)
                </label>
                <input
                  type="number"
                  id="budgetHours"
                  value={budgetHours}
                  onChange={(e) => setBudgetHours(e.target.value)}
                  step="0.01"
                  min="0"
                  disabled={project?.is_shared && !isOwner}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed text-base"
                  placeholder="0.00"
                />
              </div>
            )}

            {project?.is_shared && !isOwner && project.budget_hours && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Begroting (uren)
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                  {project.budget_hours} uren
                </div>
              </div>
            )}

            {!project?.is_shared && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  disabled={isShared}
                  className="w-4 h-4 text-[#008eff] border-gray-300 rounded focus:ring-[#008eff]"
                />
                <label
                  htmlFor="isDefault"
                  className="ml-2 text-sm text-gray-700"
                >
                  Als standaard project instellen
                </label>
              </div>
            )}

            {!project && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="w-4 h-4 text-[#008eff] border-gray-300 rounded focus:ring-[#008eff]"
                />
                <label
                  htmlFor="isShared"
                  className="ml-2 text-sm text-gray-700"
                >
                  Project delen met anderen
                </label>
              </div>
            )}

            {project && !project.is_shared && (
              <div className="pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleConvertToShared}
                  disabled={isConverting || isSaving || isDeleting}
                  className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-60 text-sm font-medium"
                >
                  {isConverting ? "Converteren..." : "Project delen"}
                </button>
              </div>
            )}

            {project?.is_shared && !isOwner && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Alleen-lezen</p>
                  <p className="text-xs">
                    Je bent lid van dit project. Alleen de eigenaar kan
                    instellingen bewerken.
                  </p>
                </div>
              </div>
            )}

            {project?.is_shared && (
              <div className="pt-2 border-t border-gray-200">
                <MembersListClient
                  user={user}
                  projectId={project.id}
                  initialMembers={members}
                  isOwner={isOwner}
                  onMemberAdded={() => loadMembers(project.id)}
                  onMemberRemoved={() => loadMembers(project.id)}
                />
              </div>
            )}

            {project && stats && stats.budgetHours && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Budget Status
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>
                      {stats.totalHours.toFixed(1)} / {stats.budgetHours} uren
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
                          {formatMoney(stats.totalMoney - stats.budgetPrice)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isSaving || isDeleting}
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60"
                disabled={
                  isSaving ||
                  isDeleting ||
                  isConverting ||
                  (project?.is_shared && !isOwner)
                }
              >
                {isSaving
                  ? "Opslaan..."
                  : project
                  ? project.is_shared && !isOwner
                    ? "Alleen-lezen"
                    : "Bijwerken"
                  : "Aanmaken"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
