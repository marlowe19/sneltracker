"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MembersListClient from "../MembersListClient";
import ProjectNotesClient from "./ProjectNotesClient";
import CalendarViewClient from "@/app/[user]/components/CalendarViewClient";

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
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
}

export default function ProjectDetailClient({
  user,
  projectId,
  project,
  isOwner,
  initialMembers = [],
  isShared,
  statisticsComponent,
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [activeTab, setActiveTab] = useState("statistieken");
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  // Settings form state
  const [name, setName] = useState(project?.name || "");
  const [hourlyRate, setHourlyRate] = useState(
    project?.hourly_rate ? String(project.hourly_rate) : ""
  );
  const [budgetHours, setBudgetHours] = useState(
    project?.budget_hours ? String(project.budget_hours) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Member management state (for settings tab)
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRate, setNewMemberRate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [memberError, setMemberError] = useState(null);

  // Member statistics state (for leden tab)
  const [memberStatistics, setMemberStatistics] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const canEdit = isShared ? isOwner : true;

  // Update form state when project prop changes
  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setHourlyRate(project.hourly_rate ? String(project.hourly_rate) : "");
      setBudgetHours(project.budget_hours ? String(project.budget_hours) : "");
    }
  }, [project]);

  // Update members state when initialMembers prop changes
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  // Switch to settings tab if members tab is active but project is not shared
  useEffect(() => {
    if (activeTab === "members" && !isShared) {
      setActiveTab("settings");
    }
  }, [activeTab, isShared]);

  // Fetch member statistics when on members tab
  useEffect(() => {
    if (activeTab === "members" && isShared && isOwner && !loadingStats) {
      fetchMemberStatistics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isShared, isOwner]);

  async function fetchMemberStatistics() {
    if (loadingStats) return; // Prevent concurrent calls

    setLoadingStats(true);
    try {
      // Fetch all-time statistics from API (no date range parameters)
      const url = new URL(
        `/${encodeURIComponent(user)}/projecten/${projectId}/api`,
        window.location.origin
      );

      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error fetching member statistics:", {
          status: res.status,
          statusText: res.statusText,
          error: errorData,
          url: url.toString(),
        });
        throw new Error(
          errorData.error || `Failed to fetch member statistics (${res.status})`
        );
      }

      const data = await res.json();
      setMemberStatistics(data.memberStatistics || null);
    } catch (err) {
      console.error("Error fetching member statistics:", err);
      setMemberStatistics(null);
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      const body = {
        id: projectId,
        name: name.trim(),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        budget_hours: budgetHours ? parseFloat(budgetHours) : null,
      };

      const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update project");
      }

      setSuccess(true);
      // Reload page data after successful save
      router.refresh();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember() {
    if (!newMemberName.trim()) return;

    setMemberError(null);
    setIsAdding(true);

    try {
      const res = await fetch(
        `/${encodeURIComponent(user)}/projecten/api?action=addMember`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            memberName: newMemberName.trim(),
            hourly_rate: newMemberRate ? parseFloat(newMemberRate) : null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add member");
      }

      // Optimistically update members list
      const newMember = {
        user_name: newMemberName.trim(),
        role: "member",
        hourly_rate: newMemberRate ? parseFloat(newMemberRate) : null,
      };
      setMembers((prev) => [...prev, newMember]);
      setNewMemberName("");
      setNewMemberRate("");

      // Refresh member statistics if on members tab
      if (activeTab === "members") {
        fetchMemberStatistics();
      }
    } catch (err) {
      setMemberError(err.message || "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveMember(memberName) {
    if (!confirm(`Weet je zeker dat je ${memberName} wilt verwijderen?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/${encodeURIComponent(
          user
        )}/projecten/api?action=removeMember&id=${projectId}&member=${encodeURIComponent(
          memberName
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      // Optimistically update members list
      setMembers((prev) => prev.filter((m) => m.user_name !== memberName));

      // Refresh member statistics if on members tab
      if (activeTab === "members") {
        fetchMemberStatistics();
      }
    } catch (err) {
      alert(err.message || "Failed to remove member");
    }
  }

  return (
    <div>
      {/* Tabs Navigation */}

      {/* <button className="btn" onClick={() => setIsCalendarExpanded(true)}>
        Calendar
      </button> */}
      {isCalendarExpanded && (
        <CalendarViewClient
          user={user}
          projectId={projectId}
          isExpanded={true}
          onClose={() => setIsCalendarExpanded(false)}
        />
      )}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("statistieken")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "statistieken"
              ? "border-[#008eff] text-[#008eff]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Statistieken
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "notes"
              ? "border-[#008eff] text-[#008eff]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Notities
        </button>
        {isShared && (
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "members"
                ? "border-[#008eff] text-[#008eff]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Leden
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-[#008eff] text-[#008eff]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Instellingen
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "statistieken" && <div>{statisticsComponent}</div>}

      {activeTab === "notes" && (
        <div>
          <ProjectNotesClient
            user={user}
            projectId={projectId}
            isShared={isShared}
          />
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Editable Fields */}
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Projectnaam *
              </label>
              <input
                type="text"
                id="projectName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
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
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
                placeholder="0.00"
              />
            </div>

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
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
                placeholder="0.00"
              />
            </div>

            {!canEdit && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <p className="font-medium mb-1">Alleen-lezen</p>
                <p className="text-xs">
                  Alleen de eigenaar kan instellingen bewerken.
                </p>
              </div>
            )}

            {canEdit && (
              <button
                type="submit"
                disabled={isSaving}
                className="w-full px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? "Opslaan..." : "Opslaan"}
              </button>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                Instellingen succesvol opgeslagen
              </div>
            )}
          </form>

          {/* Member Management Section (only for shared projects) */}
          {isShared && isOwner && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Leden beheren
              </h3>

              <div className="space-y-4">
                {/* Add New Member */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMember();
                        }
                      }}
                      placeholder="Gebruikersnaam"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
                    />
                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={isAdding || !newMemberName.trim()}
                      className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 text-sm"
                    >
                      {isAdding ? "..." : "Toevoegen"}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tarief (EUR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newMemberRate}
                      onChange={(e) => setNewMemberRate(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
                    />
                  </div>
                  {memberError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {memberError}
                    </div>
                  )}
                </div>

                {/* Existing Members List */}
                {members.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Huidige leden
                    </div>
                    {members.map((member) => (
                      <div
                        key={member.user_name}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
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
                        {member.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user_name)}
                            className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
                            title="Verwijder lid"
                          >
                            Verwijderen
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "members" && isShared && (
        <div>
          <MembersListClient
            user={user}
            projectId={projectId}
            initialMembers={members}
            isOwner={isOwner}
            memberStatistics={memberStatistics}
            loadingStats={loadingStats}
          />
        </div>
      )}
    </div>
  );
}
