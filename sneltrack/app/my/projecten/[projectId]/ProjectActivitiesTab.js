"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Link as LinkIcon } from "@carbon/icons-react";
import { useToast } from "@/app/components/Toast";

export default function ProjectActivitiesTab({ projectId, isOwner }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newActivity, setNewActivity] = useState({
    name: "",
    hourly_rate: "",
  });
  const toast = useToast();

  useEffect(() => {
    fetchActivities();
  }, [projectId]);

  async function fetchActivities() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/my/projects/${projectId}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddActivity() {
    if (!newActivity.name.trim()) return;

    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch(`/my/projects/${projectId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newActivity.name.trim(),
          hourly_rate: newActivity.hourly_rate
            ? parseFloat(newActivity.hourly_rate)
            : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add activity");
      }

      const data = await res.json();
      setActivities([...activities, data.activity]);
      setNewActivity({ name: "", hourly_rate: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleUpdateActivity(activityId, updates) {
    setError(null);
    try {
      const res = await fetch(
        `/my/projects/${projectId}/activities/${activityId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update activity");
      }

      const data = await res.json();
      setActivities(
        activities.map((a) => (a.id === activityId ? data.activity : a))
      );
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteActivity(activityId) {
    if (!confirm("Weet je zeker dat je deze activiteit wilt verwijderen?")) {
      return;
    }

    setError(null);
    try {
      const res = await fetch(
        `/my/projects/${projectId}/activities/${activityId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete activity");
      }

      setActivities(activities.filter((a) => a.id !== activityId));
    } catch (err) {
      setError(err.message);
    }
  }

  function formatMoney(amount) {
    if (!amount && amount !== 0) return "";
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  async function handleCopyLink(activity) {
    try {
      const url = `${window.location.origin}/timer/start?project=${projectId}&activity_id=${activity.id}`;
      await navigator.clipboard.writeText(url);
      toast.show("Link gekopieerd!");
    } catch (error) {
      console.error("Error copying link:", error);
      toast.show("Fout bij kopiëren van link");
    }
  }

  if (loading) {
    return <div className="p-4">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {editingId === activity.id ? (
              <div 
                className="flex-1 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  defaultValue={activity.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== activity.name) {
                      handleUpdateActivity(activity.id, {
                        name: e.target.value.trim(),
                      });
                    }
                    // Don't exit edit mode on blur - let the hourly rate input handle it
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.target.blur();
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  autoFocus
                />
                <input
                  type="number"
                  step="0.01"
                  defaultValue={activity.hourly_rate || ""}
                  placeholder="Uur tarief"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const value = e.target.value
                      ? parseFloat(e.target.value)
                      : null;
                    if (value !== activity.hourly_rate) {
                      handleUpdateActivity(activity.id, {
                        hourly_rate: value,
                      });
                    } else {
                      setEditingId(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.target.blur();
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-medium">{activity.name}</div>
                  <div className="text-sm text-gray-500">
                    {activity.hourly_rate
                      ? `${formatMoney(activity.hourly_rate)}/uur`
                      : "Geen tarief"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(activity)}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
                    title="Kopieer link om timer te starten"
                  >
                    <LinkIcon size={16} />
                    <span>Kopieer link</span>
                  </button>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => setEditingId(activity.id)}
                        className="text-gray-600 hover:text-gray-900 text-sm"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(activity.id)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Verwijderen
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {isOwner && (
        <div className="border-t pt-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Activiteit naam"
              value={newActivity.name}
              onChange={(e) =>
                setNewActivity({ ...newActivity, name: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddActivity();
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Uur tarief"
              value={newActivity.hourly_rate}
              onChange={(e) =>
                setNewActivity({ ...newActivity, hourly_rate: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddActivity();
                }
              }}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleAddActivity}
              disabled={isAdding || !newActivity.name.trim()}
              className="px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0070cc] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? "..." : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 && !isOwner && (
        <div className="text-center text-gray-500 py-8">
          Geen activiteiten beschikbaar
        </div>
      )}
    </div>
  );
}

