"use client";

import { useState, useEffect } from "react";

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
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setHourlyRate(project.hourly_rate ? String(project.hourly_rate) : "");
      setIsDefault(project.is_default || false);
    }
  }, [project]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const body = {
        name: name.trim(),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        is_default: isDefault,
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
                placeholder="Projectnaam"
              />
            </div>

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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-[#008eff] border-gray-300 rounded focus:ring-[#008eff]"
              />
              <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                Als standaard project instellen
              </label>
            </div>

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
                disabled={isSaving || isDeleting}
              >
                {isSaving ? "Opslaan..." : project ? "Bijwerken" : "Aanmaken"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
