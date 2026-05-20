"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link as LinkIcon,
  Tag,
  Add,
  Money,
} from "@carbon/icons-react";
import { useToast } from "@/app/components/Toast";

function buildMemberRows(members, ownerUserName) {
  const byName = new Map();
  for (const m of members || []) {
    if (m?.user_name) byName.set(m.user_name, m);
  }
  if (ownerUserName && !byName.has(ownerUserName)) {
    byName.set(ownerUserName, {
      user_name: ownerUserName,
      user_display_name: null,
    });
  }
  return Array.from(byName.values());
}

export default function ProjectActivitiesTab({
  projectId,
  canManageActivities = false,
  isShared = false,
  members = [],
  ownerUserName = null,
}) {
  const [activities, setActivities] = useState([]);
  const [userActivities, setUserActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // overrideInputs: userActivityId -> rate string (while inline override form is open)
  const [overrideInputs, setOverrideInputs] = useState({});
  const [savingOverride, setSavingOverride] = useState({});
  const [newActivity, setNewActivity] = useState({
    name: "",
    hourly_rate: "",
  });
  /** user_name -> input string while editing an activity */
  const [editingMemberRates, setEditingMemberRates] = useState({});
  const toast = useToast();

  const memberRows = buildMemberRows(members, ownerUserName);
  const showPerMemberRates =
    isShared && canManageActivities && memberRows.length > 0;

  const fetchActivities = useCallback(
    async (options = {}) => {
      const soft = options.soft === true;
      if (!soft) {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await fetch(`/my/projects/${projectId}/activities`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch activities");
        const data = await res.json();
        setActivities(data.activities || []);
      } catch (err) {
        setError(err.message);
      } finally {
        if (!soft) {
          setLoading(false);
        }
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!editingId) {
      setEditingMemberRates({});
      return;
    }
    const act = activities.find((a) => a.id === editingId);
    if (!act) return;
    const rates = act.member_activity_rates || {};
    const rows = buildMemberRows(members, ownerUserName);
    const init = {};
    for (const m of rows) {
      init[m.user_name] =
        rates[m.user_name] != null ? String(rates[m.user_name]) : "";
    }
    setEditingMemberRates(init);
  }, [editingId, activities, members, ownerUserName]);

  useEffect(() => {
    fetchActivities();
    fetchUserActivities();
  }, [projectId, fetchActivities]);

  async function fetchUserActivities() {
    try {
      const res = await fetch("/my/api/activities", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserActivities(data.activities || []);
      }
    } catch {
      // non-critical, silently ignore
    }
  }

  async function handleAddOverride(userActivity) {
    const rate = overrideInputs[userActivity.id];
    setSavingOverride((prev) => ({ ...prev, [userActivity.id]: true }));
    setError(null);
    try {
      const res = await fetch(`/my/projects/${projectId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userActivity.name,
          hourly_rate: rate ? parseFloat(rate) : null,
          user_activity_id: userActivity.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add price override");
      }

      const data = await res.json();
      setActivities((prev) => [...prev, data.activity]);
      setOverrideInputs((prev) => {
        const next = { ...prev };
        delete next[userActivity.id];
        return next;
      });
      toast.show(`Projectprijs opgeslagen voor ${userActivity.name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingOverride((prev) => ({ ...prev, [userActivity.id]: false }));
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

      await res.json();
      await fetchActivities({ soft: true });
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  const saveMemberActivityRates = useCallback(
    async (activityId, rateSnapshot) => {
      if (!isShared || !canManageActivities) return;
      const rows = buildMemberRows(members, ownerUserName);
      if (rows.length === 0) return;

      const member_activity_rates = {};
      for (const [uname, s] of Object.entries(rateSnapshot)) {
        if (s === "" || s == null) member_activity_rates[uname] = null;
        else {
          const n = parseFloat(String(s));
          if (Number.isFinite(n)) member_activity_rates[uname] = n;
        }
      }

      setError(null);
      try {
        const res = await fetch(
          `/my/projects/${projectId}/activities/${activityId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ member_activity_rates }),
          }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || data.message || "Opslaan mislukt");
        }
        await fetchActivities({ soft: true });
        toast.show("Teamtarieven opgeslagen");
      } catch (err) {
        setError(err.message);
      }
    },
    [
      fetchActivities,
      projectId,
      isShared,
      canManageActivities,
      members,
      ownerUserName,
      toast,
    ]
  );

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
      toast.show("Fout bij kopiëren van link", { variant: "error" });
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
                className="flex-1 flex flex-col gap-3 w-full min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    defaultValue={activity.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== activity.name) {
                        handleUpdateActivity(activity.id, {
                          name: e.target.value.trim(),
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.target.blur();
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    className="flex-1 min-w-[120px] px-2 py-1 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={activity.hourly_rate || ""}
                    placeholder="Standaard uurtarief"
                    title="Standaard voor iedereen zonder eigen teamtarief"
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
                    className="w-28 px-2 py-1 border border-gray-300 rounded text-sm shrink-0"
                  />
                </div>
                {showPerMemberRates && (
                  <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                      <Money size={14} className="text-gray-400" aria-hidden="true" />
                      Tarief per teamlid (optioneel — leeg = standaard hierboven)
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {memberRows.map((m) => (
                        <div
                          key={m.user_name}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="flex-1 min-w-0 truncate text-gray-700">
                            {m.user_display_name || m.user_name}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="—"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm shrink-0"
                            value={editingMemberRates[m.user_name] ?? ""}
                            onChange={(e) =>
                              setEditingMemberRates((prev) => ({
                                ...prev,
                                [m.user_name]: e.target.value,
                              }))
                            }
                            onBlur={(e) => {
                              const v = e.target.value;
                              setEditingMemberRates((prev) => {
                                const next = { ...prev, [m.user_name]: v };
                                queueMicrotask(() =>
                                  saveMemberActivityRates(activity.id, next)
                                );
                                return next;
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <span className="text-xs text-gray-500 shrink-0">
                            €/uur
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-medium">{activity.name}</div>
                  <div className="text-sm text-gray-500">
                    {(() => {
                      const r =
                        activity.effective_hourly_rate ?? activity.hourly_rate;
                      return r != null
                        ? `${formatMoney(r)}/uur`
                        : "Geen tarief";
                    })()}
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
                  {canManageActivities && (
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

      {/* Global activities price overrides */}
      {canManageActivities && userActivities.length > 0 && (() => {
        const linkedNames = new Set(activities.map((a) => a.name));
        const unlinked = userActivities.filter((ua) => !linkedNames.has(ua.name));
        if (unlinked.length === 0) return null;
        return (
          <div className="border-t pt-4 space-y-2">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Tag size={16} className="text-gray-400" aria-hidden="true" />
              Globale activiteiten — projectprijs instellen
            </div>
            <p className="text-xs text-gray-500">
              Geef een activiteit een afwijkende prijs voor dit project. Die prijs wordt gebruikt als je de timer start met dit project en die activiteit.
            </p>
            <div className="space-y-2">
              {unlinked.map((ua) => {
                const isOpen = ua.id in overrideInputs;
                return (
                  <div
                    key={ua.id}
                    className="flex items-center justify-between p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{ua.name}</div>
                      {ua.hourly_rate != null && (
                        <div className="text-xs text-gray-500">
                          Globaal: {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(ua.hourly_rate)}/uur
                        </div>
                      )}
                    </div>
                    {isOpen ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Projecttarief"
                          value={overrideInputs[ua.id]}
                          onChange={(e) =>
                            setOverrideInputs((prev) => ({
                              ...prev,
                              [ua.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddOverride(ua);
                            if (e.key === "Escape")
                              setOverrideInputs((prev) => {
                                const next = { ...prev };
                                delete next[ua.id];
                                return next;
                              });
                          }}
                          autoFocus
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => handleAddOverride(ua)}
                          disabled={savingOverride[ua.id]}
                          className="px-3 py-1 bg-[#008eff] text-white rounded text-sm hover:bg-[#0070cc] disabled:opacity-50"
                        >
                          {savingOverride[ua.id] ? "..." : "Opslaan"}
                        </button>
                        <button
                          onClick={() =>
                            setOverrideInputs((prev) => {
                              const next = { ...prev };
                              delete next[ua.id];
                              return next;
                            })
                          }
                          className="text-gray-400 hover:text-gray-600 text-sm"
                        >
                          Annuleren
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setOverrideInputs((prev) => ({ ...prev, [ua.id]: "" }))
                        }
                        className="text-[#008eff] hover:text-[#0070cc] text-sm flex items-center gap-1"
                      >
                        <Add size={16} aria-hidden="true" />
                        Projectprijs
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {canManageActivities && (
        <div className="border-t pt-4">
          <div className="flex gap-2 overflow-x-hidden">
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
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md"
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
              className="w-32 min-w-0 shrink-0 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleAddActivity}
              disabled={isAdding || !newActivity.name.trim()}
              className="px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0070cc] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isAdding ? "..." : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 && !canManageActivities && (
        <div className="text-center text-gray-500 py-8">
          Geen activiteiten beschikbaar
        </div>
      )}
    </div>
  );
}

