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
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
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
      const res = await fetch(
        `/${encodeURIComponent(user)}/projecten/api?action=updateMemberRate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            memberName,
            hourly_rate: editRateValue ? parseFloat(editRateValue) : null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update rate");
      }

      // Optimistically update members list with new rate
      setMembers((prev) =>
        prev.map((m) =>
          m.user_name === memberName
            ? { ...m, hourly_rate: editRateValue ? parseFloat(editRateValue) : null }
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
