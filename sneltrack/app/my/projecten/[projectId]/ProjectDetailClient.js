"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MembersListClient from "../MembersListClient";
import ProjectNotesClient from "./ProjectNotesClient";
import CalendarViewClient from "@/app/my/components/CalendarViewClient";
import ProjectForecastClient from "./ProjectForecastClient";
import ProjectEntriesListClient from "./ProjectEntriesListClient";
import ArchiveProjectModal from "./ArchiveProjectModal";
import ProjectActivitiesTab from "./ProjectActivitiesTab";

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
  initialMemberStats = null,
  isShared,
  statisticsComponent,
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [activeTab, setActiveTab] = useState("statistieken");
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [timeEntriesCount, setTimeEntriesCount] = useState(0);
  const [expensesCount, setExpensesCount] = useState(0);
  const [entriesData, setEntriesData] = useState(null);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Settings form state
  const [name, setName] = useState(project?.name || "");
  const [hourlyRate, setHourlyRate] = useState(
    project?.hourly_rate ? String(project.hourly_rate) : ""
  );
  const [budgetHours, setBudgetHours] = useState(
    project?.budget_hours ? String(project.budget_hours) : ""
  );
  const [capacity, setCapacity] = useState(
    project?.capacity_per_week ? String(project.capacity_per_week) : ""
  );
  const [priority, setPriority] = useState(
    project?.priority ? String(project.priority) : ""
  );
  const [budgetAmount, setBudgetAmount] = useState(
    project?.budget_amount ? String(project.budget_amount) : ""
  );
  const [zipCode, setZipCode] = useState(project?.zip_code || "");
  const [zipCodeError, setZipCodeError] = useState(null);
  const [deadline, setDeadline] = useState(
    project?.due_date
      ? new Date(project.due_date).toISOString().split("T")[0]
      : ""
  );
  const [startDate, setStartDate] = useState(
    project?.start_date
      ? new Date(project.start_date).toISOString().split("T")[0]
      : ""
  );
  const [actualEndDate, setActualEndDate] = useState(
    project?.actual_end_date
      ? new Date(project.actual_end_date).toISOString().split("T")[0]
      : ""
  );
  const [status, setStatus] = useState(project?.status || "active");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingArchive, setIsTogglingArchive] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Member management state (for settings tab)
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRate, setNewMemberRate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [memberError, setMemberError] = useState(null);

  // Member statistics state (for leden tab) - now using server-provided data
  const [memberStatistics, setMemberStatistics] = useState(initialMemberStats);
  const [loadingStats, setLoadingStats] = useState(false);

  // Google Calendar connection state
  const [calendarConnected, setCalendarConnected] = useState(null);
  const [checkingCalendar, setCheckingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState(null);

  const canEdit = isShared ? isOwner : true;

  // Update form state when project prop changes
  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setHourlyRate(project.hourly_rate ? String(project.hourly_rate) : "");
      setBudgetHours(project.budget_hours ? String(project.budget_hours) : "");
      setCapacity(
        project.capacity_per_week ? String(project.capacity_per_week) : ""
      );
      setPriority(project.priority ? String(project.priority) : "");
      setBudgetAmount(
        project.budget_amount ? String(project.budget_amount) : ""
      );
      setZipCode(project.zip_code || "");
      setZipCodeError(null);
      setDeadline(
        project.due_date
          ? new Date(project.due_date).toISOString().split("T")[0]
          : ""
      );
      setStartDate(
        project.start_date
          ? new Date(project.start_date).toISOString().split("T")[0]
          : ""
      );
      setStatus(project.status || "active");
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

  // Check Google Calendar connection status when on settings tab
  useEffect(() => {
    if (
      activeTab === "settings" &&
      calendarConnected === null &&
      !checkingCalendar
    ) {
      checkCalendarStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch entries data once when component mounts or projectId changes
  useEffect(() => {
    let isMounted = true;

    async function fetchEntriesData() {
      setEntriesLoading(true);
      // Reset data before fetching new data
      setEntriesData(null);
      setTimeEntriesCount(0);
      setExpensesCount(0);
      
      try {
        const res = await fetch(
          `/my/projecten/${projectId}/api?action=entries`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          // Debug: log the fetched data
          if (process.env.NODE_ENV === "development") {
            console.log("Fetched entries data:", data);
          }
          setEntriesData(data);
          setTimeEntriesCount(data.timeEntries?.length || 0);
          setExpensesCount(data.expenses?.length || 0);
        }
      } catch (err) {
        console.error("Error fetching entry data:", err);
      } finally {
        if (isMounted) {
          setEntriesLoading(false);
        }
      }
    }

    fetchEntriesData();

    return () => {
      isMounted = false;
    };
  }, [projectId]); // Only fetch when projectId changes

  // Reset entries data when projectId changes
  useEffect(() => {
    setEntriesData(null);
    setTimeEntriesCount(0);
    setExpensesCount(0);
  }, [projectId]);

  async function checkCalendarStatus() {
    setCheckingCalendar(true);
    setCalendarError(null);
    try {
      const res = await fetch(`/my/api/calendar/status`);
      if (!res.ok) {
        throw new Error("Failed to check calendar status");
      }
      const data = await res.json();
      setCalendarConnected(data.isConnected);
    } catch (err) {
      setCalendarError(err.message || "Failed to check calendar status");
    } finally {
      setCheckingCalendar(false);
    }
  }

  function handleConnectCalendar() {
    const authUrl = `/api/auth/google/authorize?user=my`;
    window.location.href = authUrl;
  }

  async function handleDisconnectCalendar() {
    if (!confirm("Weet je zeker dat je Google Calendar wilt loskoppelen?")) {
      return;
    }

    setCheckingCalendar(true);
    setCalendarError(null);
    try {
      const res = await fetch(`/my/api/calendar/status`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to disconnect calendar");
      }
      setCalendarConnected(false);
    } catch (err) {
      setCalendarError(err.message || "Failed to disconnect calendar");
    } finally {
      setCheckingCalendar(false);
    }
  }

  // Helper function to refresh member statistics (used after adding/removing members)
  async function refreshMemberStatistics() {
    if (loadingStats) return; // Prevent concurrent calls

    setLoadingStats(true);
    try {
      const url = new URL(
        `/my/projecten/${projectId}/api`,
        window.location.origin
      );

      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error refreshing member statistics:", {
          status: res.status,
          statusText: res.statusText,
          error: errorData,
          url: url.toString(),
        });
        throw new Error(
          errorData.error ||
            `Failed to refresh member statistics (${res.status})`
        );
      }

      const data = await res.json();
      setMemberStatistics(data.memberStatistics || null);
    } catch (err) {
      console.error("Error refreshing member statistics:", err);
    } finally {
      setLoadingStats(false);
    }
  }

  // Validate Dutch zip code format (1234AB)
  function validateZipCode(code) {
    if (!code || code.trim() === "") return null; // Empty is valid (optional field)
    const normalized = code.trim().toUpperCase();
    const pattern = /^[0-9]{4}[A-Z]{2}$/;
    return pattern.test(normalized) ? normalized : false;
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setZipCodeError(null);

    // Prevent concurrent saves
    if (isSaving) return;

    setIsSaving(true);

    // Validate zip code if provided
    if (zipCode && zipCode.trim() !== "") {
      const validatedZip = validateZipCode(zipCode);
      if (validatedZip === false) {
        setZipCodeError("Ongeldig postcode formaat. Gebruik 1234AB formaat.");
        setIsSaving(false);
        return;
      }
    }

    try {
      const body = {
        id: projectId,
        name: name.trim(),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        budget_hours: budgetHours ? parseFloat(budgetHours) : null,
        budget_amount: budgetAmount ? parseFloat(budgetAmount) : null,
        capacity_per_week: capacity ? parseFloat(capacity) : null,
        priority: priority ? parseInt(priority, 10) : null,
        zip_code:
          zipCode && zipCode.trim() !== ""
            ? zipCode.trim().toUpperCase()
            : null,
        due_date: deadline || null,
        start_date: startDate || null,
      };

      const res = await fetch(`/my/projecten/api`, {
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

  async function handleToggleArchive(archiveData = null) {
    // Only allow toggle between 'active' and 'archived'
    if (status !== "active" && status !== "archived") {
      setError("Kan alleen tussen actief en gearchiveerd wisselen");
      return;
    }

    const newStatus = status === "active" ? "archived" : "active";

    // If archiving, show modal instead of confirm
    if (newStatus === "archived" && !archiveData) {
      setShowArchiveModal(true);
      return;
    }

    // If unarchiving, use simple confirm
    if (newStatus === "active") {
      if (!confirm("Weet je zeker dat je dit project wilt activeren?")) {
        return;
      }
    }

    setIsTogglingArchive(true);
    setError(null);
    setShowArchiveModal(false);

    try {
      const body = {
        id: projectId,
        status: newStatus,
      };

      // Add archive data if archiving
      if (newStatus === "archived" && archiveData) {
        if (archiveData.actual_end_date) {
          body.actual_end_date = archiveData.actual_end_date;
        }
        if (archiveData.description) {
          body.description = archiveData.description;
        }
      }

      const res = await fetch(`/my/projecten/api`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update project status");
      }

      // Update local state
      setStatus(newStatus);
      // Reload page data after successful update
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to update project status");
    } finally {
      setIsTogglingArchive(false);
    }
  }

  async function handleDeleteProject() {
    if (
      !confirm(
        "Weet je zeker dat je dit project wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/my/projecten/api?id=${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }

      // Redirect to projects list after successful deletion
      router.push(`/my/projecten`);
    } catch (err) {
      setError(err.message || "Failed to delete project");
      setIsDeleting(false);
    }
  }

  async function handleAddMember() {
    if (!newMemberName.trim()) return;

    setMemberError(null);
    setIsAdding(true);

    try {
      const res = await fetch(`/my/projecten/api?action=addMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          memberName: newMemberName.trim(),
          hourly_rate: newMemberRate ? parseFloat(newMemberRate) : null,
        }),
      });

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
        refreshMemberStatistics();
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
        `/my/projecten/api?action=removeMember&id=${projectId}&member=${encodeURIComponent(
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
        refreshMemberStatistics();
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
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab("statistieken")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "notes"
                ? "border-[#008eff] text-[#008eff]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Notities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeEntries")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "timeEntries"
                ? "border-[#008eff] text-[#008eff]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Tijdregistraties {timeEntriesCount > 0 && `(${timeEntriesCount})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "expenses"
                ? "border-[#008eff] text-[#008eff]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Uitgaven {expensesCount > 0 && `(${expensesCount})`}
          </button>
          {isShared && (
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            onClick={() => setActiveTab("activities")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "activities"
                ? "border-[#008eff] text-[#008eff]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Activiteiten
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "settings"
                ? "border-[#008eff] text-[#008eff]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Instellingen
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "statistieken" && (
        <div>
          {statisticsComponent}
          <ProjectForecastClient
            user={user}
            projectId={projectId}
            project={project}
          />
        </div>
      )}

      {activeTab === "timeEntries" && (
        <div className="mb-4">
          <ProjectEntriesListClient
            user={user}
            projectId={projectId}
            type="timeEntries"
            data={entriesData}
            loading={entriesLoading}
          />
        </div>
      )}

      {activeTab === "expenses" && (
        <div className="mb-4">
          <ProjectEntriesListClient
            user={user}
            projectId={projectId}
            type="expenses"
            data={entriesData}
            loading={entriesLoading}
          />
        </div>
      )}

      {activeTab === "notes" && (
        <div className="mb-4">
          <ProjectNotesClient
            user={user}
            projectId={projectId}
            isShared={isShared}
          />
        </div>
      )}

      {activeTab === "activities" && (
        <div>
          <ProjectActivitiesTab projectId={projectId} isOwner={isOwner} />
        </div>
      )}
      {activeTab === "settings" && (
        <div className="space-y-6 mb-4">
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
                htmlFor="budgetAmount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Begroting uitgaven (EUR)
              </label>
              <input
                type="number"
                id="budgetAmount"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                step="0.01"
                min="0"
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-gray-500">
                Gebruik deze begroting om uitgaven voor dit project te volgen.
              </p>
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

            <div>
              <label
                htmlFor="capacity"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Capaciteit per week (uren)
              </label>
              <input
                type="number"
                id="capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                step="0.5"
                min="0"
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
                placeholder="0.0"
              />
            </div>

            <div>
              <label
                htmlFor="priority"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Prioriteit (5 = hoogste, 1 = laagste)
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
              >
                <option value="">Geen prioriteit</option>
                <option value="5">5 - Hoogste</option>
                <option value="4">4 - Hoog</option>
                <option value="3">3 - Gemiddeld</option>
                <option value="2">2 - Laag</option>
                <option value="1">1 - Laagste</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="zipCode"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Postcode (1234AB)
              </label>
              <input
                type="text"
                id="zipCode"
                value={zipCode}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setZipCode(value);
                  // Clear error when user types
                  if (zipCodeError) {
                    setZipCodeError(null);
                  }
                }}
                onBlur={(e) => {
                  // Validate on blur
                  if (e.target.value && e.target.value.trim() !== "") {
                    const validated = validateZipCode(e.target.value);
                    if (validated === false) {
                      setZipCodeError(
                        "Ongeldig postcode formaat. Gebruik 1234AB formaat."
                      );
                    } else if (validated) {
                      setZipCode(validated);
                      setZipCodeError(null);
                    }
                  } else {
                    setZipCodeError(null);
                  }
                }}
                maxLength={6}
                placeholder="1234AB"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  zipCodeError ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
              {zipCodeError && (
                <p className="mt-1 text-sm text-red-600">{zipCodeError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="deadline"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Project Deadline
              </label>
              <input
                type="date"
                id="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Project start datum
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEdit}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base ${
                  !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {actualEndDate && (
              <div>
                <label
                  htmlFor="actualEndDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Werkelijke einddatum
                </label>
                <input
                  type="date"
                  id="actualEndDate"
                  value={actualEndDate}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-base"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Deze datum is ingesteld bij het archiveren van het project.
                </p>
              </div>
            )}

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

          {/* Google Calendar Connection Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Google Calendar Integratie
            </h3>
            <div className="space-y-3">
              {checkingCalendar ? (
                <div className="text-sm text-gray-500">
                  Status controleren...
                </div>
              ) : calendarError ? (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {calendarError}
                </div>
              ) : calendarConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Google Calendar is verbonden</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Je agenda wordt gebruikt voor projectvoorspellingen om
                    bezette tijden uit te sluiten.
                  </p>
                  <button
                    type="button"
                    onClick={handleDisconnectCalendar}
                    disabled={checkingCalendar}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-60 text-sm"
                  >
                    Loskoppelen
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Google Calendar is niet verbonden</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Verbind je Google Calendar om bezette tijden uit te sluiten
                    bij projectvoorspellingen.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectCalendar}
                    className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] text-sm"
                  >
                    Verbind Google Calendar
                  </button>
                </div>
              )}
            </div>
          </div>

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
                            {member.user_display_name || member.user_name}
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
          {/* Archive/Unarchive Project Section */}
          {canEdit && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Project Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Huidige status:
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        status === "archived"
                          ? "bg-gray-200 text-gray-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {status === "archived" ? "Gearchiveerd" : "Actief"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  {status === "archived"
                    ? "Dit project is gearchiveerd. Activeer het om het weer beschikbaar te maken."
                    : "Archiveer dit project om het te verbergen zonder het te verwijderen."}
                </p>
                <button
                  type="button"
                  onClick={handleToggleArchive}
                  disabled={isTogglingArchive || isSaving || isDeleting}
                  className={`w-full px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium ${
                    status === "archived"
                      ? "bg-[#008eff] text-white"
                      : "bg-gray-600 text-white"
                  }`}
                >
                  {isTogglingArchive
                    ? status === "archived"
                      ? "Activeren..."
                      : "Archiveren..."
                    : status === "archived"
                    ? "Project Activeren"
                    : "Project Archiveren"}
                </button>
                {error && isTogglingArchive && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Delete Project Section */}
          {canEdit && (
            <div className="mt-8 pt-8 border-t border-red-200">
              <h3 className="text-sm font-semibold text-red-900 mb-4">
                Gevaarlijke Zone
              </h3>
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Het verwijderen van een project kan niet ongedaan worden
                  gemaakt. Alle tijdregistraties en gegevens die aan dit project
                  zijn gekoppeld, blijven behouden.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={isDeleting || isSaving}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isDeleting ? "Verwijderen..." : "Project Verwijderen"}
                </button>
                {error && isDeleting && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "members" && isShared && (
        <div className="mb-4">
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

      {/* Archive Project Modal */}
      <ArchiveProjectModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onArchive={handleToggleArchive}
        projectName={name}
        isArchiving={isTogglingArchive}
      />
    </div>
  );
}
