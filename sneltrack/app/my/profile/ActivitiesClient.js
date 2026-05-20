"use client";

import { useState, useEffect } from "react";
import { Add, Activity, Link as LinkIcon } from "@carbon/icons-react";
import { useToast } from "@/app/components/Toast";

function formatMoney(amount) {
  if (!amount && amount !== 0) return "";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ActivitiesClient({ userId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [managingId, setManagingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add form state
  const [name, setName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  // Edit state
  const [editName, setEditName] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editArchived, setEditArchived] = useState(false);

  const toast = useToast();

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/my/api/activities?includeArchived=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Kon activiteiten niet ophalen");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(activity) {
    setEditingId(activity.id);
    setEditName(activity.name);
    setEditHourlyRate(activity.hourly_rate != null ? String(activity.hourly_rate) : "");
    setEditArchived(activity.archived ?? false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditHourlyRate("");
    setEditArchived(false);
    setManagingId(null);
  }

  async function handleAdd() {
    if (!name.trim()) {
      setError("Vul een naam in");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch("/my/api/activities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet toevoegen");
      }

      const data = await res.json();
      setActivities((prev) => [...prev, data.activity]);
      setName("");
      setHourlyRate("");
      setShowAddForm(false);
      setSuccessMessage("Activiteit toegevoegd");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!editName.trim()) {
      setError("Vul een naam in");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch(`/my/api/activities/${editingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          hourly_rate: editHourlyRate ? parseFloat(editHourlyRate) : null,
          archived: editArchived,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet bijwerken");
      }

      const data = await res.json();
      setActivities((prev) =>
        prev.map((a) => (a.id === editingId ? data.activity : a))
      );
      cancelEdit();
      setSuccessMessage("Activiteit bijgewerkt");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(activityId) {
    try {
      setError(null);
      const res = await fetch(`/my/api/activities/${activityId}/archive`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet archiveren");
      }

      const data = await res.json();
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? data.activity : a))
      );
      setSuccessMessage("Activiteit gearchiveerd");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnarchive(activityId) {
    try {
      setError(null);
      const res = await fetch(`/my/api/activities/${activityId}/unarchive`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet terugzetten");
      }

      const data = await res.json();
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? data.activity : a))
      );
      setSuccessMessage("Activiteit teruggezet");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch(`/my/api/activities/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kon niet verwijderen");
      }

      setActivities((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) cancelEdit();
      if (managingId === id) setManagingId(null);
      setSuccessMessage("Activiteit verwijderd");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCopyLink(e, activity) {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/my/start?activity_id=${activity.id}`;
      await navigator.clipboard.writeText(url);
      toast.show("Link gekopieerd!");
    } catch (err) {
      console.error("Error copying link:", err);
      toast.show("Fout bij kopiëren van link", { variant: "error" });
    }
  }

  const activeActivities = activities.filter((a) => !a.archived);
  const archivedActivities = activities.filter((a) => a.archived);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      <div className="space-y-4">
        {showAddForm ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Nieuwe activiteit toevoegen
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sluiten
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naam *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="bijv. Werk, Lunch, Vergadering"
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uurtarief (€/uur)
                </label>
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[#008eff] focus-within:border-transparent">
                  <span className="pl-3 text-gray-500 text-base">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    inputMode="decimal"
                    className="flex-1 min-w-0 py-2 pr-2 border-0 focus:outline-none focus:ring-0 text-base"
                  />
                  <span className="pr-3 text-gray-500 text-sm">/uur</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={isSaving}
                className="w-full px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSaving ? "Toevoegen..." : "Toevoegen"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm font-medium text-[#008eff] hover:text-[#0066b3]"
          >
            <Add size={16} />
            Toevoegen
          </button>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Jou activiteiten
        </h3>
        {activeActivities.length === 0 && archivedActivities.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">
            Geen activiteiten. Voeg hierboven een nieuwe toe.
          </p>
        ) : (
          <div className="space-y-2">
            {activeActivities.map((activity) => (
              <div
                key={activity.id}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                {editingId === activity.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Naam
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="bijv. Werk, Reizen"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Uurtarief (€/uur)
                      </label>
                      <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[#008eff] focus-within:border-transparent">
                        <span className="pl-3 text-gray-500 text-base">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editHourlyRate}
                          onChange={(e) => setEditHourlyRate(e.target.value)}
                          placeholder="0,00"
                          inputMode="decimal"
                          className="flex-1 min-w-0 py-2 pr-2 border-0 focus:outline-none focus:ring-0 text-base"
                        />
                        <span className="pr-3 text-gray-500 text-sm">/uur</span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editArchived}
                        onChange={(e) => setEditArchived(e.target.checked)}
                      />
                      <span className="text-sm text-gray-700">Gearchiveerd</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleUpdate}
                        disabled={isSaving}
                        className="px-3 py-1.5 bg-[#008eff] text-white rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        Opslaan
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Activity size={18} className="text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">
                          {activity.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {activity.hourly_rate != null
                            ? formatMoney(activity.hourly_rate) + "/uur"
                            : "Geen tarief"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyLink(e, activity)}
                          className="p-2 text-gray-500 hover:text-[#008eff] hover:bg-gray-100 rounded"
                          title="Link kopiëren"
                        >
                          <LinkIcon size={18} />
                        </button>
                        {managingId !== activity.id && (
                          <button
                            type="button"
                            onClick={() => setManagingId(activity.id)}
                            className="text-sm font-medium text-[#008eff] hover:text-[#0066b3] whitespace-nowrap"
                          >
                            Beheren
                          </button>
                        )}
                      </div>
                    </div>
                    {managingId === activity.id && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => startEdit(activity)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-sm text-[#008eff] hover:bg-[#008eff]/10 rounded disabled:opacity-50"
                        >
                          Bewerken
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(activity.id)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-sm text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                        >
                          Archiveren
                        </button>
                        <button
                          type="button"
                          onClick={() => setManagingId(null)}
                          className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded"
                        >
                          Sluiten
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {archivedActivities.length > 0 && (
          <div className="space-y-2 mt-6">
            <h1 className="text-sm font-semibold text-gray-900">
              Gearchiveerd
            </h1>
            <div className="space-y-2">
              {archivedActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  {editingId === activity.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Naam
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="bijv. Werk, Reizen"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Uurtarief (€/uur)
                        </label>
                        <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[#008eff] focus-within:border-transparent">
                          <span className="pl-3 text-gray-500 text-base">€</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editHourlyRate}
                            onChange={(e) => setEditHourlyRate(e.target.value)}
                            placeholder="0,00"
                            inputMode="decimal"
                            className="flex-1 min-w-0 py-2 pr-2 border-0 focus:outline-none focus:ring-0 text-base"
                          />
                          <span className="pr-3 text-gray-500 text-sm">/uur</span>
                        </div>
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editArchived}
                          onChange={(e) => setEditArchived(e.target.checked)}
                        />
                        <span className="text-sm text-gray-700">Gearchiveerd</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleUpdate}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-[#008eff] text-white rounded-md text-sm font-medium disabled:opacity-50"
                        >
                          Opslaan
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isSaving}
                          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm font-medium disabled:opacity-50"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Activity size={18} className="text-gray-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">
                            {activity.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {activity.hourly_rate != null
                              ? formatMoney(activity.hourly_rate) + "/uur"
                              : "Geen tarief"}
                            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              Gearchiveerd
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {managingId !== activity.id && (
                            <button
                              type="button"
                              onClick={() => setManagingId(activity.id)}
                              className="text-sm font-medium text-[#008eff] hover:text-[#0066b3] whitespace-nowrap"
                            >
                              Beheren
                            </button>
                          )}
                        </div>
                      </div>
                      {managingId === activity.id && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => startEdit(activity)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-sm text-[#008eff] hover:bg-[#008eff]/10 rounded disabled:opacity-50"
                          >
                            Bewerken
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnarchive(activity.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-sm text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                          >
                            Terugzetten
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(activity.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-sm text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                          >
                            Verwijderen
                          </button>
                          <button
                            type="button"
                            onClick={() => setManagingId(null)}
                            className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded"
                          >
                            Sluiten
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
