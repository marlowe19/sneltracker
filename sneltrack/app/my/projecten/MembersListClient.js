"use client";

import { useState, useEffect } from "react";

function formatMoney(amount) {
  if (!amount && amount !== 0) return "";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(totalHours) {
  if (!totalHours && totalHours !== 0) return "-";
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
}

export default function MembersListClient({
  user,
  projectId,
  initialMembers = [],
  isOwner = false,
  memberStatistics = null,
  loadingStats = false,
}) {
  const [members, setMembers] = useState(initialMembers);
  const [editingRate, setEditingRate] = useState(null);
  const [editRateValue, setEditRateValue] = useState("");
  const [editingCapacity, setEditingCapacity] = useState(null);
  const [editCapacityValue, setEditCapacityValue] = useState("");
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [isUpdatingCapacity, setIsUpdatingCapacity] = useState(false);
  const [calculatingCapacity, setCalculatingCapacity] = useState(null);
  const [calculatedCapacity, setCalculatedCapacity] = useState(null);
  const [error, setError] = useState(null);

  // Update members when initialMembers changes
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  // Create a map of member statistics for quick lookup
  const statsMap = new Map();
  if (memberStatistics) {
    memberStatistics.forEach((stat) => {
      statsMap.set(stat.user_name, stat);
    });
  }

  function handleStartEditRate(member) {
    setEditingRate(member.user_name);
    setEditRateValue(member.hourly_rate ? String(member.hourly_rate) : "");
  }

  function handleCancelEditRate() {
    setEditingRate(null);
    setEditRateValue("");
  }

  async function handleSaveRate(memberName) {
    setIsUpdatingRate(true);
    setError(null);

    try {
      const res = await fetch(`/my/projecten/api?action=updateMemberRate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          memberName,
          hourly_rate: editRateValue ? parseFloat(editRateValue) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update rate");
      }

      // Optimistically update members list with new rate
      setMembers((prev) =>
        prev.map((m) =>
          m.user_name === memberName
            ? {
                ...m,
                hourly_rate: editRateValue ? parseFloat(editRateValue) : null,
              }
            : m
        )
      );
      setEditingRate(null);
      setEditRateValue("");
    } catch (err) {
      setError(err.message || "Failed to update rate");
    } finally {
      setIsUpdatingRate(false);
    }
  }

  function handleStartEditCapacity(member) {
    setEditingCapacity(member.user_name);
    setEditCapacityValue(
      member.capacity_per_week ? String(member.capacity_per_week) : ""
    );
  }

  function handleCancelEditCapacity() {
    setEditingCapacity(null);
    setEditCapacityValue("");
  }

  async function handleSaveCapacity(memberName) {
    setIsUpdatingCapacity(true);
    setError(null);

    try {
      const res = await fetch(`/my/projecten/api?action=updateMemberCapacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          memberName,
          capacity_per_week:
            editCapacityValue && editCapacityValue.trim() !== ""
              ? parseFloat(editCapacityValue)
              : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update capacity");
      }

      // Optimistically update members list with new capacity
      setMembers((prev) =>
        prev.map((m) =>
          m.user_name === memberName
            ? {
                ...m,
                capacity_per_week:
                  editCapacityValue && editCapacityValue.trim() !== ""
                    ? parseFloat(editCapacityValue)
                    : null,
              }
            : m
        )
      );
      setEditingCapacity(null);
      setEditCapacityValue("");
      // Clear calculated capacity after saving
      setCalculatedCapacity(null);
    } catch (err) {
      setError(err.message || "Failed to update capacity");
    } finally {
      setIsUpdatingCapacity(false);
    }
  }

  async function handleCalculateCapacityFromCalendar(memberName) {
    setCalculatingCapacity(memberName);
    setError(null);

    try {
      const res = await fetch(
        `/my/api/calendar/capacity?memberName=${memberName}`
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Capaciteit uit agenda berekenen mislukt"
        );
      }

      const data = await res.json();
      setCalculatedCapacity({
        memberName,
        capacity: data.capacityPerWeek,
        week1: data.week1,
        week2: data.week2,
      });

      // Auto-fill the capacity field if editing (use average for now)
      if (editingCapacity === memberName) {
        setEditCapacityValue(String(data.capacityPerWeek));
      } else {
        // Start editing with calculated value
        setEditingCapacity(memberName);
        setEditCapacityValue(String(data.capacityPerWeek));
      }
    } catch (err) {
      setError(err.message || "Capaciteit uit agenda berekenen mislukt");
    } finally {
      setCalculatingCapacity(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">Leden</div>

      {loadingStats && (
        <div className="text-sm text-gray-500 text-center py-2">
          Statistieken laden...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {members.map((member) => {
          const stats = statsMap.get(member.user_name);
          return (
            <div
              key={member.user_name}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {member.user_name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      member.role === "owner"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {member.role === "owner" ? "Eigenaar" : "Lid"}
                  </span>
                </div>
                {editingRate === member.user_name ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editRateValue}
                      onChange={(e) => setEditRateValue(e.target.value)}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-base"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRate(member.user_name)}
                      disabled={isUpdatingRate}
                      className="text-green-600 hover:text-green-700 text-sm"
                      title="Opslaan"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditRate}
                      disabled={isUpdatingRate}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                      title="Annuleren"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Tarief:{" "}
                      {member.hourly_rate !== null &&
                      member.hourly_rate !== undefined
                        ? formatMoney(member.hourly_rate)
                        : "Geen tarief"}
                    </span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleStartEditRate(member)}
                        className="text-blue-400 hover:text-blue-600 text-xs"
                        title="Bewerk tarief"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Capacity Section */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                {editingCapacity === member.user_name ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">
                      Capaciteit per week:
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editCapacityValue}
                      onChange={(e) => setEditCapacityValue(e.target.value)}
                      placeholder="0.0"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-base"
                      autoFocus
                    />
                    <span className="text-xs text-gray-500">uren/week</span>
                    <button
                      type="button"
                      onClick={() => handleSaveCapacity(member.user_name)}
                      disabled={isUpdatingCapacity}
                      className="text-green-600 hover:text-green-700 text-sm"
                      title="Opslaan"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditCapacity}
                      disabled={isUpdatingCapacity}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                      title="Annuleren"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">
                      Capaciteit:{" "}
                      {member.capacity_per_week !== null &&
                      member.capacity_per_week !== undefined
                        ? `${member.capacity_per_week} uren/week`
                        : "Niet ingesteld"}
                    </span>
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEditCapacity(member)}
                          className="text-blue-400 hover:text-blue-600 text-xs"
                          title="Bewerk capaciteit"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCalculateCapacityFromCalendar(
                              member.user_name
                            )
                          }
                          disabled={calculatingCapacity === member.user_name}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Bereken capaciteit uit Google Calendar (volgende 2 weken)"
                        >
                          {calculatingCapacity === member.user_name
                            ? "..."
                            : "📅"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {calculatedCapacity?.memberName === member.user_name &&
                  (() => {
                    // Use member's capacity_per_week or default to 40 hours/week
                    const plannedCapacity = member.capacity_per_week || 40;
                    const week1Hours = calculatedCapacity.week1?.hours || 0;
                    const week2Hours = calculatedCapacity.week2?.hours || 0;

                    // Calculate percentages (can exceed 100%)
                    const week1Percentage =
                      plannedCapacity > 0
                        ? (week1Hours / plannedCapacity) * 100
                        : 0;
                    const week2Percentage =
                      plannedCapacity > 0
                        ? (week2Hours / plannedCapacity) * 100
                        : 0;

                    return (
                      <div className="text-xs mt-1 space-y-2">
                        <div className="font-medium text-gray-700">
                          Berekend uit agenda:
                        </div>

                        {/* Week 1 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Week 1</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 relative">
                            <div
                              className={`h-2 rounded-full relative ${
                                week1Percentage < 100
                                  ? "bg-red-500"
                                  : week1Percentage >= 100
                                  ? "bg-green-500"
                                  : "bg-yellow-500"
                              }`}
                              style={{
                                width: `${Math.min(week1Percentage, 100)}%`,
                              }}
                            >
                              {/* Label on top of progress bar at end of fill */}
                              {week1Percentage > 0 && (
                                <span
                                  className="absolute top-0 text-xs font-medium text-gray-700 whitespace-nowrap"
                                  style={{
                                    right: 0,
                                    transform:
                                      week1Percentage >= 95
                                        ? "translateY(-100%) translateY(-12px)"
                                        : "translateY(-100%)",
                                    marginBottom: "2px",
                                  }}
                                >
                                  {week1Hours.toFixed(1)} uur
                                </span>
                              )}
                            </div>
                            {/* Label on top of bar at end (100% = planned capacity) */}
                            <span
                              className="absolute top-0 text-xs text-gray-500 whitespace-nowrap"
                              style={{
                                right: 0,
                                transform: "translateY(-100%)",
                                marginBottom: "2px",
                              }}
                            >
                              {plannedCapacity.toFixed(1)} uur
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {week1Percentage.toFixed(1)}% van{" "}
                            {plannedCapacity.toFixed(1)} uur geplande capaciteit
                          </div>
                        </div>

                        {/* Week 2 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Week 2</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 relative">
                            <div
                              className={`h-2 rounded-full relative ${
                                week2Percentage < 100
                                  ? "bg-red-500"
                                  : week2Percentage >= 100
                                  ? "bg-green-500"
                                  : "bg-yellow-500"
                              }`}
                              style={{
                                width: `${Math.min(week2Percentage, 100)}%`,
                              }}
                            >
                              {/* Label on top of progress bar at end of fill */}
                              {week2Percentage > 0 && (
                                <span
                                  className="absolute top-0 text-xs font-medium text-gray-700 whitespace-nowrap"
                                  style={{
                                    right: 0,
                                    transform:
                                      week2Percentage >= 95
                                        ? "translateY(-100%) translateY(-12px)"
                                        : "translateY(-100%)",
                                    marginBottom: "2px",
                                  }}
                                >
                                  {week2Hours.toFixed(1)} uur
                                </span>
                              )}
                            </div>
                            {/* Label on top of bar at end (100% = planned capacity) */}
                            <span
                              className="absolute top-0 text-xs text-gray-500 whitespace-nowrap"
                              style={{
                                right: 0,
                                transform: "translateY(-100%)",
                                marginBottom: "2px",
                              }}
                            >
                              {plannedCapacity.toFixed(1)} uur
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {week2Percentage.toFixed(1)}% van{" "}
                            {plannedCapacity.toFixed(1)} uur geplande capaciteit
                          </div>
                        </div>

                        {/* Average (text only) */}
                        <div className="font-medium pt-0.5 text-gray-700">
                          Gemiddeld: {calculatedCapacity.capacity.toFixed(1)}{" "}
                          uren/week
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Statistics for selected period */}
              {stats ? (
                <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-gray-200">
                  <div>
                    <div className="text-xs text-gray-500">Totaal uren</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatHours(stats.totalHours)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Totaal waarde</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatMoney(stats.totalMoney)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200">
                  Geen uren geregistreerd in de geselecteerde periode
                </div>
              )}
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-2">
          Nog geen leden
        </div>
      )}
    </div>
  );
}
