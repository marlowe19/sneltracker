"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/stores/useStore";
import { computeEntryDurationMs } from "@/lib/time";
import { useToast } from "@/app/components/Toast";
import { formatLocalDate } from "@/lib/dateRangeUtils";
import NotificationBadge from "@/app/components/NotificationBadge";
import { mapEntryToEditable } from "@/lib/utils/entryMapper";
import { getCurrentDate } from "@/lib/dateRangeUtils";
import {
  Alarm,
  ChevronLeft,
  ChevronLeft24,
  ToolBox,
  ChevronDown,
  ChevronUp,
} from "@carbon/icons-react";
function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDayDateWithTime(dayDate, timeString) {
  if (!dayDate || !timeString) return null;
  const [hours, minutes] = timeString.split(":");

  const date = new Date(dayDate);
  const localDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    parseInt(hours, 10) || 0,
    parseInt(minutes, 10) || 0,
    0,
    0
  );
  return localDate;
}

function formatHoursMinutes(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function parseDuration(durationString) {
  if (!durationString || durationString.trim() === "") return null;
  const parts = durationString.split(":");
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return (hours * 60 + minutes) * 60 * 1000;
}

function formatDurationInput(value) {
  let cleaned = value.replace(/[^\d:]/g, "");

  if (!cleaned) return "";

  if (!cleaned.includes(":")) {
    if (cleaned.length <= 2) {
      return `${cleaned}:00`;
    } else if (cleaned.length === 3) {
      return `${cleaned[0]}:${cleaned.slice(1)}`;
    } else {
      return `${cleaned.slice(0, -2)}:${cleaned.slice(-2)}`;
    }
  }

  const parts = cleaned.split(":");
  if (parts.length > 2) {
    return `${parts[0]}:${parts[1]}`;
  }

  const [hoursStr, minutesStr] = parts;
  const hours = parseInt(hoursStr, 10) || 0;
  let minutes = parseInt(minutesStr || "0", 10) || 0;

  if (minutes > 59) {
    minutes = 59;
  }

  const formattedMinutes = String(minutes).padStart(2, "0");
  return `${hours}:${formattedMinutes}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function DayEntriesListClient({
  user,
  selectedDate,
  onEntryUpdate,
  onClose, // Add this prop
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const projects = useStore((state) => state.projects);
  const addEntry = useStore((state) => state.addEntry);
  const updateEntry = useStore((state) => state.updateEntry);
  const replaceTempEntry = useStore((state) => state.replaceTempEntry);
  const deleteEntry = useStore((state) => state.deleteEntry);
  const fetchDayExpenses = useStore((state) => state.fetchDayExpenses);
  const addExpense = useStore((state) => state.addExpense);
  const updateExpense = useStore((state) => state.updateExpense);
  const replaceTempExpense = useStore((state) => state.replaceTempExpense);
  const deleteExpense = useStore((state) => state.deleteExpense);
  const expenses = useStore((state) => state.expenses);
  const userDisplayName = useStore((state) => state.userDisplayName);

  const [localEntries, setLocalEntries] = useState([]);
  const [localExpenses, setLocalExpenses] = useState([]);
  const [membersCache, setMembersCache] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("entries");
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [savingEntryId, setSavingEntryId] = useState(null);
  const [expandedExpenses, setExpandedExpenses] = useState(new Set());
  const [savingExpenseId, setSavingExpenseId] = useState(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entryActivities, setEntryActivities] = useState({}); // entryId -> activities array
  const [expandedActivities, setExpandedActivities] = useState(new Set()); // entryIds with activities expanded
  const [editingActivityId, setEditingActivityId] = useState(null); // activityId being edited
  const [editingActivityData, setEditingActivityData] = useState(null); // temporary edit data
  const toast = useToast();
  // Memoize dayDateString to ensure stable reference
  const dayDateString = useMemo(
    () => selectedDate?.toISOString(),
    [selectedDate]
  );

  // Fetch day expenses
  useEffect(() => {
    if (selectedDate) {
      fetchDayExpenses(user, selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayDateString, user]);

  const fetchDayEntries = async (user, dayDate) => {
    try {
      setLoadingEntries(true);
      const dateStr = formatLocalDate(dayDate);
      const res = await fetch(`/my/api/day-entries?dayDate=${dateStr}`);
      if (!res.ok) throw new Error("Failed to fetch day entries");
      const data = await res.json();
      const mappedEntries = (data.entries || []).map(mapEntryToEditable);
      console.log(mappedEntries);
      setLocalEntries(mappedEntries);
      setLoadingEntries(false);
    } catch (error) {
      console.error("Error fetching day entries:", error);
    }
  };
  // Fetch day entries
  useEffect(() => {
    if (selectedDate) {
      fetchDayEntries(user, selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayDateString, user]);

  // Initialize activities from entries (activities are now included in the query)
  useEffect(() => {
    if (localEntries.length > 0) {
      const activitiesMap = {};
      localEntries.forEach((entry) => {
        if (entry.activities && entry.activities.length > 0) {
          activitiesMap[entry.id] = entry.activities;
        }
      });
      if (Object.keys(activitiesMap).length > 0) {
        setEntryActivities((prev) => ({ ...prev, ...activitiesMap }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localEntries]);

  // // Initialize entries
  // useEffect(() => {
  //   if (initialEntries && selectedDate) {
  //     const sortedEntries = [...initialEntries].sort((a, b) => {
  //       const dateA = new Date(a.created_at || a.modified_at || 0);
  //       const dateB = new Date(b.created_at || b.modified_at || 0);
  //       return dateB - dateA;
  //     });

  //     const mappedEntries = sortedEntries.map((entry) => {
  //       const durationMs =
  //         entry.duration_ms ??
  //         (entry.end_time
  //           ? computeEntryDurationMs(entry.start_time, entry.end_time, null)
  //           : null);

  //       return {
  //         ...entry,
  //         start_time_editable: formatTime(entry.start_time),
  //         end_time_editable: formatTime(entry.end_time),
  //         duration_editable: durationMs ? formatHoursMinutes(durationMs) : "",
  //         hourly_rate_editable: entry.hourly_rate ?? "",
  //         project_editable: entry.project ?? "",
  //         isProjectMember: false,
  //       };
  //     });

  //     setLocalEntries(mappedEntries);

  //     // Automatically expand temp entries
  //     const tempEntryIds = mappedEntries
  //       .filter((entry) => entry.id && entry.id.startsWith("temp-"))
  //       .map((entry) => entry.id);
  //     if (tempEntryIds.length > 0) {
  //       setExpandedEntries((prev) => new Set([...prev, ...tempEntryIds]));
  //     }
  //   }
  // }, [dayDateString, initialEntries]);

  // Initialize expenses
  useEffect(() => {
    if (expenses && selectedDate) {
      const sortedExpenses = [...expenses].sort((a, b) => {
        const dateA = new Date(a.created_at || a.modified_at || 0);
        const dateB = new Date(b.created_at || b.modified_at || 0);
        return dateB - dateA;
      });

      const mappedExpenses = sortedExpenses.map((expense) => ({
        ...expense,
        name_editable: expense.name ?? "",
        price_editable:
          expense.price !== null && expense.price !== undefined
            ? String(expense.price)
            : "",
        project_editable: expense.project ?? "",
        includes_vat_editable: expense.includes_vat ?? false,
      }));

      setLocalExpenses(mappedExpenses);

      // Automatically expand temp expenses
      const tempExpenseIds = mappedExpenses
        .filter(
          (expense) => expense.id && expense.id.startsWith("temp-expense-")
        )
        .map((expense) => expense.id);
      if (tempExpenseIds.length > 0) {
        setExpandedExpenses((prev) => new Set([...prev, ...tempExpenseIds]));
      }
    }
  }, [expenses, selectedDate, dayDateString]);

  // Fetch notes
  useEffect(() => {
    async function fetchNotes() {
      if (!selectedDate || !user) {
        setNotes([]);
        return;
      }

      setLoadingNotes(true);
      setNotesError(null);

      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const dueDate = `${year}-${month}-${day}`;

        const url = new URL(`/my/notes/api`, window.location.origin);
        url.searchParams.set("dueDate", dueDate);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch notes: ${res.status}`);
        }

        const data = await res.json();
        setNotes(data.notes || []);
      } catch (err) {
        console.error("Error fetching notes:", err);
        setNotesError(err.message || "Kon notities niet ophalen");
        setNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    }

    fetchNotes();
  }, [dayDateString, user]);

  const handleEntryChange = async (index, field, value) => {
    const updated = [...localEntries];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "project_editable") {
      if (value) {
        const selectedProject = projects.find((p) => p.id === value);
        if (selectedProject) {
          // For shared projects, check membership status (but use member_hourly_rate from project)
          if (selectedProject.is_shared) {
            // Check membership status (still need this for isProjectMember flag)
            if (membersCache[value]) {
              const members = membersCache[value];
              const currentUserMember = members.find(
                (m) => m.user_name === user
              );
              updated[index].isProjectMember = !!currentUserMember;
            } else {
              // Fetch members only to check membership status
              try {
                const res = await fetch(
                  `/my/projecten/api?action=members&projectId=${value}`
                );
                const data = await res.json();
                const members = data.members || [];
                setMembersCache((prev) => ({ ...prev, [value]: members }));
                const currentUserMember = members.find(
                  (m) => m.user_name === user
                );
                updated[index].isProjectMember = !!currentUserMember;
              } catch (error) {
                console.error("Error fetching member status:", error);
                updated[index].isProjectMember = false;
              }
            }

            // Use member_hourly_rate from project (already populated by getUserProjectsWithStats)
            // Priority: member_hourly_rate > hourly_rate
            if (
              selectedProject.member_hourly_rate !== null &&
              selectedProject.member_hourly_rate !== undefined
            ) {
              updated[index].hourly_rate_editable = String(
                selectedProject.member_hourly_rate
              );
            } else if (selectedProject.hourly_rate) {
              updated[index].hourly_rate_editable = String(
                selectedProject.hourly_rate
              );
            }
          } else {
            // Non-shared project
            updated[index].isProjectMember = false;
            if (selectedProject.hourly_rate) {
              updated[index].hourly_rate_editable = String(
                selectedProject.hourly_rate
              );
            }
          }
        }
      } else {
        updated[index].isProjectMember = false;
      }
    }

    if (field === "start_time_editable" || field === "end_time_editable") {
      const entry = updated[index];
      const isRunning = entry.is_running === true;

      if (
        isRunning &&
        field === "start_time_editable" &&
        entry.start_time_editable &&
        selectedDate
      ) {
        const newStart = combineDayDateWithTime(
          selectedDate,
          entry.start_time_editable
        );
        if (newStart) {
          const now = new Date();
          const durationMs = now - newStart;
          if (durationMs > 0) {
            updated[index].duration_editable = formatHoursMinutes(durationMs);
          }
        }
      } else if (
        entry.start_time_editable &&
        entry.end_time_editable &&
        selectedDate &&
        !isRunning
      ) {
        const start = combineDayDateWithTime(
          selectedDate,
          entry.start_time_editable
        );
        const end = combineDayDateWithTime(
          selectedDate,
          entry.end_time_editable
        );
        if (start && end) {
          const durationMs = end - start;
          if (durationMs > 0) {
            updated[index].duration_editable = formatHoursMinutes(durationMs);
          }
        }
      }
    }

    setLocalEntries(updated);
  };

  const handleDurationBlur = (index) => {
    const updated = [...localEntries];
    const value = updated[index].duration_editable;
    if (value) {
      const formatted = formatDurationInput(value);
      updated[index].duration_editable = formatted;
      setLocalEntries(updated);
    }
  };

  async function fetchEntryActivities(entryId) {
    try {
      const res = await fetch(`/my/entries/${entryId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setEntryActivities((prev) => ({
          ...prev,
          [entryId]: data.activities || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching entry activities:", error);
    }
  }

  const handleEditActivity = async (entryId, activityId, activityData) => {
    try {
      const res = await fetch(
        `/my/entries/${entryId}/activities/${activityId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(activityData),
        }
      );

      if (res.ok) {
        // Refresh activities for this entry
        await fetchEntryActivities(entryId);
        setEditingActivityId(null);
        setEditingActivityData(null);
        toast.show("Activiteit bijgewerkt");
        // Refresh entries to get updated activities
        await fetchDayEntries(user, selectedDate);
        startTransition(() => router.refresh());
      } else {
        const error = await res.json();
        toast.show(error.message || "Fout bij bijwerken van activiteit");
      }
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.show("Fout bij bijwerken van activiteit");
    }
  };

  const handleDeleteActivity = async (entryId, activityId) => {
    if (!confirm("Weet je zeker dat je deze activiteit wilt verwijderen?")) {
      return;
    }

    try {
      const res = await fetch(
        `/my/entries/${entryId}/activities/${activityId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        // Remove from local state
        setEntryActivities((prev) => ({
          ...prev,
          [entryId]: (prev[entryId] || []).filter((a) => a.id !== activityId),
        }));
        toast.show("Activiteit verwijderd");
        // Refresh entries to get updated activities
        await fetchDayEntries(user, selectedDate);
        startTransition(() => router.refresh());
      } else {
        const error = await res.json();
        toast.show(error.message || "Fout bij verwijderen van activiteit");
      }
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast.show("Fout bij verwijderen van activiteit");
    }
  };

  const startEditingActivity = (activity) => {
    setEditingActivityId(activity.id);
    setEditingActivityData({
      activity_type: activity.activity_type,
      hourly_rate: activity.hourly_rate || "",
      billable: activity.billable !== false,
      start_time: activity.start_time ? formatTime(activity.start_time) : "",
      end_time: activity.end_time ? formatTime(activity.end_time) : "",
      original_start_time: activity.start_time, // Store original for date preservation
      original_end_time: activity.end_time,
    });
  };

  const cancelEditingActivity = () => {
    setEditingActivityId(null);
    setEditingActivityData(null);
  };

  const handleToggleExpand = (entryId) => {
    setExpandedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const handleToggleExpandExpense = (expenseId) => {
    setExpandedExpenses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId);
      } else {
        newSet.add(expenseId);
      }
      return newSet;
    });
  };

  const calculateEntryTotal = (entry) => {
    const durationMs =
      entry.duration_ms ??
      (entry.end_time
        ? computeEntryDurationMs(entry.start_time, entry.end_time, null)
        : 0);

    if (!durationMs) return 0;

    const hourlyRate =
      entry.hourly_rate_editable !== undefined &&
      entry.hourly_rate_editable !== ""
        ? parseFloat(entry.hourly_rate_editable)
        : entry.hourly_rate;

    if (!hourlyRate) return 0;

    const hours = durationMs / (1000 * 60 * 60);
    return hours * hourlyRate;
  };

  const handleAddEntry = () => {
    if (!selectedDate) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newEntry = {
      id: tempId,
      user_name: user,
      user_display_name: userDisplayName || null,
      start_time: null,
      end_time: null,
      duration_ms: null,
      hourly_rate: null,
      project: null,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      start_time_editable: "",
      end_time_editable: "",
      duration_editable: "",
      hourly_rate_editable: "",
      project_editable: "",
      isProjectMember: false,
    };

    setLocalEntries([newEntry, ...localEntries]);
    // Automatically expand new entries for immediate editing
    setExpandedEntries((prev) => new Set([...prev, tempId]));
  };

  const handleExpenseChange = (index, field, value) => {
    const updated = [...localExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setLocalExpenses(updated);
  };

  const handleAddExpense = () => {
    if (!selectedDate) return;

    const tempId = `temp-expense-${Date.now()}-${Math.random()}`;
    const newExpense = {
      id: tempId,
      user_name: user,
      user_display_name: userDisplayName || null,
      project: null,
      name: "",
      price: null,
      includes_vat: false,
      expense_type: "materials",
      date: selectedDate.toISOString(),
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      name_editable: "",
      price_editable: "",
      project_editable: "",
      includes_vat_editable: false,
    };

    setLocalExpenses([newExpense, ...localExpenses]);
    // Automatically expand new expenses for immediate editing
    setExpandedExpenses((prev) => new Set([...prev, tempId]));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Process entries (reuse logic from DayEntriesModalClient)
      const updatePromises = localEntries.map(async (entry) => {
        const isNewEntry = entry.id && entry.id.startsWith("temp-");

        if (isNewEntry) {
          if (!selectedDate) {
            throw new Error("Day date is required");
          }

          const updates = {};
          let durationWasEdited = false;

          const hasStartTime =
            entry.start_time_editable &&
            entry.start_time_editable.trim() !== "";
          const hasEndTime =
            entry.end_time_editable && entry.end_time_editable.trim() !== "";

          if (
            entry.duration_editable !== undefined &&
            entry.duration_editable !== "" &&
            !hasStartTime
          ) {
            const newDurationMs = parseDuration(entry.duration_editable);
            if (newDurationMs !== null) {
              updates.duration_ms = newDurationMs;
              durationWasEdited = true;
            }
          }

          if (durationWasEdited && selectedDate && updates.duration_ms) {
            // Create UTC midnight for the selected date to avoid timezone issues
            const date = new Date(selectedDate);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const day = date.getUTCDate();
            const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
            const dayEnd = new Date(dayStart.getTime() + updates.duration_ms);
            updates.start_time = dayStart.toISOString();
            updates.end_time = dayEnd.toISOString();
          } else {
            if (entry.start_time_editable && selectedDate) {
              const newStart = combineDayDateWithTime(
                selectedDate,
                entry.start_time_editable
              );
              if (newStart) {
                updates.start_time = newStart.toISOString();
              }
            }

            if (entry.end_time_editable && selectedDate) {
              const newEnd = combineDayDateWithTime(
                selectedDate,
                entry.end_time_editable
              );
              if (newEnd) {
                updates.end_time = newEnd.toISOString();
              }
            }

            if (updates.start_time && updates.end_time) {
              const start = new Date(updates.start_time);
              const end = new Date(updates.end_time);
              const durationMs = end - start;
              if (durationMs > 0) {
                updates.duration_ms = durationMs;
              }
            } else if (
              entry.duration_editable &&
              entry.duration_editable !== "" &&
              !hasStartTime
            ) {
              const newDurationMs = parseDuration(entry.duration_editable);
              if (newDurationMs !== null) {
                updates.duration_ms = newDurationMs;
              }
            }
          }

          if (
            entry.hourly_rate_editable !== undefined &&
            entry.hourly_rate_editable !== ""
          ) {
            updates.hourly_rate = parseFloat(entry.hourly_rate_editable);
          }

          if (
            entry.project_editable !== undefined &&
            entry.project_editable !== ""
          ) {
            updates.project_id = entry.project_editable;
          }

          if (entry.billable_editable !== undefined) {
            updates.billable = entry.billable_editable;
          }

          const response = await fetch(`/my/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayDate: selectedDate.toISOString(),
              duration_ms: updates.duration_ms ?? null,
              hourly_rate: updates.hourly_rate ?? null,
              project_id: updates.project_id ?? null,
              start_time: updates.start_time ?? null,
              end_time: updates.end_time ?? null,
              billable: updates.billable ?? true,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to create entry");
          }

          const responseData = await response.json();
          if (responseData.entry) {
            replaceTempEntry(entry.id, responseData.entry);
          }

          return { success: true };
        }

        // Existing entry - update it
        const updates = {};
        let durationWasEdited = false;

        const hasStartTime =
          entry.start_time_editable && entry.start_time_editable.trim() !== "";
        const hasEndTime =
          entry.end_time_editable && entry.end_time_editable.trim() !== "";

        if (
          entry.duration_editable !== undefined &&
          entry.duration_editable !== "" &&
          !hasStartTime
        ) {
          const newDurationMs = parseDuration(entry.duration_editable);
          const currentDurationMs = entry.duration_ms;

          if (newDurationMs !== null && newDurationMs !== currentDurationMs) {
            updates.duration_ms = newDurationMs;
            durationWasEdited = true;
          }
        }

        if (durationWasEdited && selectedDate && updates.duration_ms) {
          const date = new Date(selectedDate);
          const dayStart = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          );
          const dayEnd = new Date(dayStart.getTime() + updates.duration_ms);
          updates.start_time = dayStart.toISOString();
          updates.end_time = dayEnd.toISOString();
        } else {
          if (entry.start_time_editable && !durationWasEdited && selectedDate) {
            const newStart = combineDayDateWithTime(
              selectedDate,
              entry.start_time_editable
            );
            if (newStart && newStart.toISOString() !== entry.start_time) {
              updates.start_time = newStart.toISOString();

              if (entry.is_running === true) {
                const now = new Date();
                const durationMs = now - newStart;
                if (durationMs > 0) {
                  updates.duration_ms = durationMs;
                }
              }
            }
          }

          if (
            entry.end_time_editable &&
            !durationWasEdited &&
            selectedDate &&
            entry.is_running !== true
          ) {
            const newEnd = combineDayDateWithTime(
              selectedDate,
              entry.end_time_editable
            );
            const currentEnd = entry.end_time
              ? new Date(entry.end_time).toISOString()
              : null;
            if (newEnd && newEnd.toISOString() !== currentEnd) {
              updates.end_time = newEnd.toISOString();
            }
          }

          if (
            hasStartTime &&
            hasEndTime &&
            updates.start_time &&
            updates.end_time &&
            entry.is_running !== true
          ) {
            const start = new Date(updates.start_time);
            const end = new Date(updates.end_time);
            const durationMs = end - start;
            if (durationMs > 0) {
              updates.duration_ms = durationMs;
            }
          }
        }

        if (entry.hourly_rate_editable !== undefined) {
          const newRate =
            entry.hourly_rate_editable === "" ||
            entry.hourly_rate_editable === null
              ? null
              : parseFloat(entry.hourly_rate_editable);
          const currentRate = entry.hourly_rate;
          if (newRate !== currentRate) {
            updates.hourly_rate = newRate;
          }
        }

        if (entry.project_editable !== undefined) {
          const newProject =
            entry.project_editable === "" || entry.project_editable === null
              ? null
              : entry.project_editable;
          const currentProject = entry.project_id;
          if (newProject !== currentProject) {
            updates.project_id = newProject;
          }
        }

        if (entry.billable_editable !== undefined) {
          const newBillable = Boolean(entry.billable_editable);
          const currentBillable = entry.billable ?? true;
          if (newBillable !== currentBillable) {
            updates.billable = newBillable;
          }
        }

        if (Object.keys(updates).length > 0) {
          const response = await fetch(`/my/entries/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update entry");
          }

          const responseData = await response.json();
          if (responseData.entry) {
            updateEntry(entry.id, responseData.entry);
          }

          return { success: true };
        }

        return { success: true };
      });

      await Promise.all(updatePromises);

      // Process expenses
      const expensePromises = localExpenses.map(async (expense) => {
        const isNewExpense =
          expense.id && expense.id.startsWith("temp-expense-");

        if (isNewExpense) {
          if (!selectedDate) {
            throw new Error("Day date is required");
          }
          if (!expense.project_editable || expense.project_editable === "") {
            throw new Error("Project is required for expense");
          }
          if (!expense.name_editable || expense.name_editable.trim() === "") {
            throw new Error("Name is required for expense");
          }
          if (!expense.price_editable || expense.price_editable === "") {
            throw new Error("Price is required for expense");
          }

          const response = await fetch(`/my/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayDate: getCurrentDate(selectedDate),
              project: expense.project_editable,
              name: expense.name_editable.trim(),
              price: parseFloat(expense.price_editable),
              includes_vat: expense.includes_vat_editable ?? false,
              expense_type: "materials",
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to create expense");
          }

          const responseData = await response.json();
          if (responseData.expense) {
            replaceTempExpense(expense.id, responseData.expense);
          }

          return { success: true };
        }

        const updates = {};

        if (expense.name_editable !== undefined) {
          const newName = expense.name_editable.trim();
          if (newName !== expense.name) {
            updates.name = newName;
          }
        }

        if (expense.price_editable !== undefined) {
          const newPrice =
            expense.price_editable === "" || expense.price_editable === null
              ? null
              : parseFloat(expense.price_editable);
          const currentPrice = expense.price;
          if (newPrice !== currentPrice) {
            updates.price = newPrice;
          }
        }

        if (expense.includes_vat_editable !== undefined) {
          const newIncludesVat = Boolean(expense.includes_vat_editable);
          const currentIncludesVat = expense.includes_vat ?? false;
          if (newIncludesVat !== currentIncludesVat) {
            updates.includes_vat = newIncludesVat;
          }
        }

        if (expense.project_editable !== undefined) {
          const newProject =
            expense.project_editable === "" || expense.project_editable === null
              ? null
              : expense.project_editable;
          const currentProject = expense.project;
          if (newProject !== currentProject) {
            updates.project = newProject;
          }
        }

        if (Object.keys(updates).length > 0) {
          const response = await fetch(`/my/expenses/${expense.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update expense");
          }

          const responseData = await response.json();
          if (responseData.expense) {
            updateExpense(expense.id, responseData.expense);
          }

          return { success: true };
        }

        return { success: true };
      });

      await Promise.all(expensePromises);

      setSuccessMessage("Wijzigingen opgeslagen");
      setIsSaving(false);

      //   // Call update callback
      //   if (onEntryUpdate) {
      //     onEntryUpdate();
      //   }
      toast.show("Wijzigingen opgeslagen");
    } catch (err) {
      setError(err.message || "Failed to save changes");
      setIsSaving(false);
    }
  };

  const handleSaveEntry = async (index) => {
    const entry = localEntries[index];
    if (!entry) return;

    const originalEntryId = entry.id; // Store original ID for collapsing
    setSavingEntryId(entry.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const isNewEntry = entry.id && entry.id.startsWith("temp-");

      if (isNewEntry) {
        if (!selectedDate) {
          throw new Error("Day date is required");
        }

        const updates = {};
        let durationWasEdited = false;

        const hasStartTime =
          entry.start_time_editable && entry.start_time_editable.trim() !== "";
        const hasEndTime =
          entry.end_time_editable && entry.end_time_editable.trim() !== "";

        if (
          entry.duration_editable !== undefined &&
          entry.duration_editable !== "" &&
          !hasStartTime
        ) {
          const newDurationMs = parseDuration(entry.duration_editable);
          if (newDurationMs !== null) {
            updates.duration_ms = newDurationMs;
            durationWasEdited = true;
          }
        }

        if (durationWasEdited && selectedDate && updates.duration_ms) {
          const date = new Date(selectedDate);
          const dayStart = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          );
          const dayEnd = new Date(dayStart.getTime() + updates.duration_ms);
          updates.start_time = dayStart.toISOString();
          updates.end_time = dayEnd.toISOString();
        } else {
          if (entry.start_time_editable && selectedDate) {
            const newStart = combineDayDateWithTime(
              selectedDate,
              entry.start_time_editable
            );
            if (newStart) {
              updates.start_time = newStart.toISOString();
            }
          }

          if (entry.end_time_editable && selectedDate) {
            const newEnd = combineDayDateWithTime(
              selectedDate,
              entry.end_time_editable
            );
            if (newEnd) {
              updates.end_time = newEnd.toISOString();
            }
          }

          if (updates.start_time && updates.end_time) {
            const start = new Date(updates.start_time);
            const end = new Date(updates.end_time);
            const durationMs = end - start;
            if (durationMs > 0) {
              updates.duration_ms = durationMs;
            }
          } else if (
            entry.duration_editable &&
            entry.duration_editable !== "" &&
            !hasStartTime
          ) {
            const newDurationMs = parseDuration(entry.duration_editable);
            if (newDurationMs !== null) {
              updates.duration_ms = newDurationMs;
            }
          }
        }

        if (
          entry.hourly_rate_editable !== undefined &&
          entry.hourly_rate_editable !== ""
        ) {
          updates.hourly_rate = parseFloat(entry.hourly_rate_editable);
        }

        if (
          entry.project_editable !== undefined &&
          entry.project_editable !== ""
        ) {
          updates.project_id = entry.project_editable;
        }

        if (entry.billable_editable !== undefined) {
          updates.billable = entry.billable_editable;
        }

        const response = await fetch(`/my/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayDate: selectedDate.toISOString(),
            duration_ms: updates.duration_ms ?? null,
            hourly_rate: updates.hourly_rate ?? null,
            project_id: updates.project_id ?? null,
            start_time: updates.start_time ?? null,
            end_time: updates.end_time ?? null,
            billable: updates.billable ?? true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create entry");
        }

        const responseData = await response.json();
        if (responseData.entry) {
          replaceTempEntry(entry.id, responseData.entry);
          // Update local entries with the new entry data
          const updated = [...localEntries];
          updated[index] = {
            ...responseData.entry,
            start_time_editable: formatTime(responseData.entry.start_time),
            end_time_editable: formatTime(responseData.entry.end_time),
            duration_editable: responseData.entry.duration_ms
              ? formatHoursMinutes(responseData.entry.duration_ms)
              : "",
            hourly_rate_editable: responseData.entry.hourly_rate ?? "",
            project_editable: responseData.entry.project_id ?? "",
            isProjectOwner: responseData.entry.isProjectOwner ?? false,
            isProjectMember: responseData.entry.isProjectMember ?? false,
          };
          setLocalEntries(updated);

          // Collapse the entry after saving
          setExpandedEntries((prev) => {
            const newSet = new Set(prev);
            newSet.delete(originalEntryId);
            newSet.delete(responseData.entry.id); // Also remove new ID in case it was added
            return newSet;
          });
        }

        setSuccessMessage("Entry opgeslagen");
        setSavingEntryId(null);

        // Call update callback (for parent components to refresh their data)
        // if (onEntryUpdate) {
        //   onEntryUpdate();
        // }

        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      } else {
        // Existing entry - update it
        const updates = {};
        let durationWasEdited = false;

        const hasStartTime =
          entry.start_time_editable && entry.start_time_editable.trim() !== "";
        const hasEndTime =
          entry.end_time_editable && entry.end_time_editable.trim() !== "";

        if (
          entry.duration_editable !== undefined &&
          entry.duration_editable !== "" &&
          !hasStartTime
        ) {
          const newDurationMs = parseDuration(entry.duration_editable);
          const currentDurationMs = entry.duration_ms;

          if (newDurationMs !== null && newDurationMs !== currentDurationMs) {
            updates.duration_ms = newDurationMs;
            durationWasEdited = true;
          }
        }

        if (durationWasEdited && selectedDate && updates.duration_ms) {
          const date = new Date(selectedDate);
          const dayStart = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          );
          const dayEnd = new Date(dayStart.getTime() + updates.duration_ms);
          updates.start_time = dayStart.toISOString();
          updates.end_time = dayEnd.toISOString();
        } else {
          if (entry.start_time_editable && !durationWasEdited && selectedDate) {
            const newStart = combineDayDateWithTime(
              selectedDate,
              entry.start_time_editable
            );
            if (newStart && newStart.toISOString() !== entry.start_time) {
              updates.start_time = newStart.toISOString();

              if (entry.is_running === true) {
                const now = new Date();
                const durationMs = now - newStart;
                if (durationMs > 0) {
                  updates.duration_ms = durationMs;
                }
              }
            }
          }

          if (
            entry.end_time_editable &&
            !durationWasEdited &&
            selectedDate &&
            entry.is_running !== true
          ) {
            const newEnd = combineDayDateWithTime(
              selectedDate,
              entry.end_time_editable
            );
            const currentEnd = entry.end_time
              ? new Date(entry.end_time).toISOString()
              : null;
            if (newEnd && newEnd.toISOString() !== currentEnd) {
              updates.end_time = newEnd.toISOString();
            }
          }

          if (
            hasStartTime &&
            hasEndTime &&
            updates.start_time &&
            updates.end_time &&
            entry.is_running !== true
          ) {
            const start = new Date(updates.start_time);
            const end = new Date(updates.end_time);
            const durationMs = end - start;
            if (durationMs > 0) {
              updates.duration_ms = durationMs;
            }
          }
        }

        if (entry.hourly_rate_editable !== undefined) {
          const newRate =
            entry.hourly_rate_editable === "" ||
            entry.hourly_rate_editable === null
              ? null
              : parseFloat(entry.hourly_rate_editable);
          const currentRate = entry.hourly_rate;
          if (newRate !== currentRate) {
            updates.hourly_rate = newRate;
          }
        }

        if (entry.project_editable !== undefined) {
          const newProject =
            entry.project_editable === "" || entry.project_editable === null
              ? null
              : entry.project_editable;
          const currentProject = entry.project_id;
          if (newProject !== currentProject) {
            updates.project_id = newProject;
          }
        }

        if (entry.billable_editable !== undefined) {
          const newBillable = Boolean(entry.billable_editable);
          const currentBillable = entry.billable ?? true;
          if (newBillable !== currentBillable) {
            updates.billable = newBillable;
          }
        }

        if (Object.keys(updates).length > 0) {
          const response = await fetch(`/my/entries/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update entry");
          }

          const responseData = await response.json();
          if (responseData.entry) {
            updateEntry(entry.id, responseData.entry);
            // Update local entry with the updated data
            const updated = [...localEntries];
            updated[index] = {
              ...responseData.entry,
              start_time_editable: formatTime(responseData.entry.start_time),
              end_time_editable: formatTime(responseData.entry.end_time),
              duration_editable: responseData.entry.duration_ms
                ? formatHoursMinutes(responseData.entry.duration_ms)
                : "",
              hourly_rate_editable: responseData.entry.hourly_rate ?? "",
              project_editable: responseData.entry.project_id ?? "",
              isProjectOwner: responseData.entry.isProjectOwner ?? false,
              isProjectMember: responseData.entry.isProjectMember ?? false,
            };
            setLocalEntries(updated);

            // Collapse the entry after saving
            setExpandedEntries((prev) => {
              const newSet = new Set(prev);
              newSet.delete(entry.id);
              return newSet;
            });
          }

          setSuccessMessage("Entry opgeslagen");
          setSavingEntryId(null);

          //   // Call update callback (for parent components to refresh their data)
          //   if (onEntryUpdate) {
          //     onEntryUpdate();
          //   }

          setTimeout(() => {
            setSuccessMessage(null);
          }, 3000);
        } else {
          // No changes to save, just collapse
          setExpandedEntries((prev) => {
            const newSet = new Set(prev);
            newSet.delete(entry.id);
            return newSet;
          });
          setSavingEntryId(null);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to save entry");
      setSavingEntryId(null);
    }
  };

  const handleSaveExpense = async (index) => {
    const expense = localExpenses[index];
    if (!expense) return;

    const originalExpenseId = expense.id; // Store original ID for collapsing
    setSavingExpenseId(expense.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const isNewExpense = expense.id && expense.id.startsWith("temp-expense-");

      if (isNewExpense) {
        if (!selectedDate) {
          throw new Error("Day date is required");
        }
        if (!expense.project_editable || expense.project_editable === "") {
          throw new Error("Project is required for expense");
        }
        if (!expense.name_editable || expense.name_editable.trim() === "") {
          throw new Error("Name is required for expense");
        }
        if (!expense.price_editable || expense.price_editable === "") {
          throw new Error("Price is required for expense");
        }

        const response = await fetch(`/my/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayDate: getCurrentDate(selectedDate),
            project: expense.project_editable,
            name: expense.name_editable.trim(),
            price: parseFloat(expense.price_editable),
            includes_vat: expense.includes_vat_editable ?? false,
            expense_type: "materials",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create expense");
        }

        const responseData = await response.json();
        if (responseData.expense) {
          replaceTempExpense(expense.id, responseData.expense);
          // Update local expenses with the new expense data
          const updated = [...localExpenses];
          updated[index] = {
            ...responseData.expense,
            name_editable: responseData.expense.name ?? "",
            price_editable:
              responseData.expense.price !== null &&
              responseData.expense.price !== undefined
                ? String(responseData.expense.price)
                : "",
            project_editable: responseData.expense.project ?? "",
            includes_vat_editable: responseData.expense.includes_vat ?? false,
          };
          setLocalExpenses(updated);

          // Collapse the expense after saving
          setExpandedExpenses((prev) => {
            const newSet = new Set(prev);
            newSet.delete(originalExpenseId);
            newSet.delete(responseData.expense.id); // Also remove new ID in case it was added
            return newSet;
          });
        }

        setSuccessMessage("Uitgave opgeslagen");
        setSavingExpenseId(null);

        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      } else {
        // Existing expense - update it
        const updates = {};

        if (expense.name_editable !== undefined) {
          const newName = expense.name_editable.trim();
          if (newName !== expense.name) {
            updates.name = newName;
          }
        }

        if (expense.price_editable !== undefined) {
          const newPrice =
            expense.price_editable === "" || expense.price_editable === null
              ? null
              : parseFloat(expense.price_editable);
          const currentPrice = expense.price;
          if (newPrice !== currentPrice) {
            updates.price = newPrice;
          }
        }

        if (expense.includes_vat_editable !== undefined) {
          const newIncludesVat = Boolean(expense.includes_vat_editable);
          const currentIncludesVat = expense.includes_vat ?? false;
          if (newIncludesVat !== currentIncludesVat) {
            updates.includes_vat = newIncludesVat;
          }
        }

        if (expense.project_editable !== undefined) {
          const newProject =
            expense.project_editable === "" || expense.project_editable === null
              ? null
              : expense.project_editable;
          const currentProject = expense.project;
          if (newProject !== currentProject) {
            updates.project = newProject;
          }
        }

        if (Object.keys(updates).length > 0) {
          const response = await fetch(`/my/expenses/${expense.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update expense");
          }

          const responseData = await response.json();
          if (responseData.expense) {
            updateExpense(expense.id, responseData.expense);
            // Update local expense with the updated data
            const updated = [...localExpenses];
            updated[index] = {
              ...responseData.expense,
              name_editable: responseData.expense.name ?? "",
              price_editable:
                responseData.expense.price !== null &&
                responseData.expense.price !== undefined
                  ? String(responseData.expense.price)
                  : "",
              project_editable: responseData.expense.project ?? "",
              includes_vat_editable: responseData.expense.includes_vat ?? false,
            };
            setLocalExpenses(updated);

            // Collapse the expense after saving
            setExpandedExpenses((prev) => {
              const newSet = new Set(prev);
              newSet.delete(expense.id);
              return newSet;
            });
          }

          setSuccessMessage("Uitgave opgeslagen");
          setSavingExpenseId(null);

          setTimeout(() => {
            setSuccessMessage(null);
          }, 3000);
        } else {
          // No changes to save, just collapse
          setExpandedExpenses((prev) => {
            const newSet = new Set(prev);
            newSet.delete(expense.id);
            return newSet;
          });
          setSavingExpenseId(null);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to save expense");
      setSavingExpenseId(null);
    }
  };

  const handleDeleteEntry = async (entryId, index) => {
    if (!confirm("Weet je zeker dat je deze entry wilt verwijderen?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/my/entries/${entryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete entry");
      }

      deleteEntry(entryId);

      const updated = localEntries.filter((_, i) => i !== index);
      setLocalEntries(updated);
      setIsDeleting(false);

      if (onEntryUpdate) {
        onEntryUpdate();
      }

      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to delete entry");
      setIsDeleting(false);
    }
  };

  const handleDeleteExpense = async (expenseId, index) => {
    if (!confirm("Weet je zeker dat je deze uitgave wilt verwijderen?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/my/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete expense");
      }

      deleteExpense(expenseId);

      const updated = localExpenses.filter((_, i) => i !== index);
      setLocalExpenses(updated);
      setIsDeleting(false);

      if (onEntryUpdate) {
        onEntryUpdate();
      }
    } catch (err) {
      setError(err.message || "Failed to delete expense");
      setIsDeleting(false);
    }
  };

  // Calculate summary totals
  const calculateEntrySummary = () => {
    const entryCount = localEntries.length;
    let totalHoursMs = 0;
    let totalPrice = 0;

    localEntries.forEach((entry) => {
      const durationMs =
        entry.duration_ms ??
        (entry.end_time
          ? computeEntryDurationMs(entry.start_time, entry.end_time, null)
          : 0);
      totalHoursMs += durationMs || 0;

      if (durationMs) {
        const hourlyRate =
          entry.hourly_rate_editable !== undefined &&
          entry.hourly_rate_editable !== ""
            ? parseFloat(entry.hourly_rate_editable)
            : entry.hourly_rate;
        if (hourlyRate) {
          const hours = durationMs / (1000 * 60 * 60);
          totalPrice += hours * hourlyRate;
        }
      }
    });

    return {
      count: entryCount,
      totalHours: formatHoursMinutes(totalHoursMs),
      totalPrice: totalPrice.toFixed(2),
    };
  };

  const calculateExpenseSummary = () => {
    const expenseCount = localExpenses.length;
    let totalPrice = 0;

    localExpenses.forEach((expense) => {
      const price = parseFloat(expense.price_editable || expense.price || 0);
      totalPrice += price || 0;
    });

    return {
      count: expenseCount,
      totalPrice: totalPrice.toFixed(2),
    };
  };

  const entrySummary = calculateEntrySummary();
  const expenseSummary = calculateExpenseSummary();

  const dayDateFormatted = selectedDate
    ? selectedDate.toLocaleDateString("nl-NL", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  if (!selectedDate) return <div>Geen dag geselecteerd</div>;

  return (
    <div
      className="w-full flex flex-col h-full"
      style={{
        padding: "1rem",
        paddingTop: "calc(1rem + env(safe-area-inset-top))",
      }}
    >
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-[#e6e6e6] border rounded-xl bg-[#f5f5f5] justify-between">
          <div className="flex items-center">
            {/* Back Button with Carbon Icons Chevron */}
            <button
              type="button"
              className="mr-3 p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#008eff] transition"
              aria-label="Terug"
              onClick={() => {
                if (onClose) onClose();
              }}
            >
              {/* Use react-carbon ChevronLeft Icon */}
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              className="text-gray-500 text-base hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#008eff] rounded px-1"
              onClick={() => {
                if (onClose) onClose();
              }}
            >
              Terug
            </button>
          </div>
          {/* Day Date */}
          <div className="self-stretch flex pt-4 gap-2 items-center justify-start ">
            <div>
              <div className="w-7 p-1 bg-sky-500 rounded-[999px] inline-flex justify-center items-center overflow-hidden">
                <div className="text-center justify-center text-white text-sm font-normal leading-5">
                  {selectedDate.getDate()}
                </div>
              </div>
            </div>
            <div className="justify-start text-App-settings-color-color-app-text-black text-base font-medium leading-5">
              {dayDateFormatted}
            </div>
          </div>
          {/* Summary */}
          <div className="self-stretch flex justify-between pt-4  gap-4">
            <div className="flex-1 inline-flex flex-col justify-start items-start gap-1">
              <div className="justify-center text-App-settings-color-color-app-text-black text-sm font-normal line-clamp-1">
                {activeTab === "expenses" ? "Uitgaven" : "Registraties"}
              </div>
              <div className="self-stretch justify-center text-App-settings-color-color-app-text-black text-lg font-bold">
                {activeTab === "expenses"
                  ? expenseSummary.count
                  : entrySummary.count}
              </div>
            </div>
            <div className="flex-1 inline-flex flex-col justify-start items-start gap-1">
              <div className="self-stretch justify-center text-App-settings-color-color-app-text-black text-sm font-normal line-clamp-1">
                {activeTab === "expenses" ? "Totaal prijs" : "Uren"}
              </div>
              <div className="self-stretch justify-center text-App-settings-color-color-app-text-black text-lg font-bold">
                {activeTab === "expenses"
                  ? `€${expenseSummary.totalPrice}`
                  : entrySummary.totalHours}
              </div>
            </div>
            {activeTab !== "expenses" && (
              <div className="flex-1 inline-flex flex-col justify-start items-start gap-1">
                <div className="self-stretch justify-center text-App-settings-color-color-app-text-black text-sm font-normal line-clamp-1">
                  Totaal prijs
                </div>
                <div className="self-stretch justify-center text-Color-Solids-color-solid-aqua-green text-lg font-bold">
                  €{entrySummary.totalPrice}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("entries")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "entries"
                ? "text-[#008eff] border-b-2 border-[#008eff]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Tijdregistraties
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "expenses"
                ? "text-[#008eff] border-b-2 border-[#008eff]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Uitgaven
          </button>
          {notes.length > 0 && (
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center relative ${
                activeTab === "notes"
                  ? "text-[#008eff] border-b-2 border-[#008eff]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="relative">
                Notities
                <NotificationBadge user={user} />
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="pb-4 flex-1 min-h-0 overflow-hidden">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {/* Time Entries Tab */}
        <div
          className={`relative h-full overflow-y-auto ${
            activeTab === "entries" ? "" : "hidden"
          }`}
        >
          {/* Entries List */}
          {localEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8 bg-white rounded-lg">
              Geen entries gevonden voor deze dag
            </p>
          ) : (
            <div className="space-y-4 pt-4 pb-20">
              {localEntries.map((entry, index) => {
                const isExpanded = expandedEntries.has(entry.id);

                //const entryTotal = calculateEntryTotal(entry);
                const startTimeDisplay =
                  entry.start_time_editable ||
                  formatTime(entry.start_time) ||
                  "-";
                const endTimeDisplay =
                  entry.end_time_editable || formatTime(entry.end_time) || "-";
                const durationDisplay =
                  entry.duration_editable ||
                  (entry.duration_ms
                    ? formatHoursMinutes(entry.duration_ms)
                    : "-");
                const hourlyRateDisplay =
                  entry.hourly_rate_editable !== undefined &&
                  entry.hourly_rate_editable !== ""
                    ? parseFloat(entry.hourly_rate_editable).toFixed(2)
                    : entry.hourly_rate
                    ? entry.hourly_rate.toFixed(2)
                    : "-";

                return (
                  <div
                    // onClick={() => handleToggleExpand(entry.id)}
                    key={entry.id}
                    className="rounded-lg border cursor-pointer border-gray-200 p-4 space-y-4 bg-white transition-all duration-200"
                  >
                    <div
                      onClick={() => handleToggleExpand(entry.id)}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`px-2 py-0.5 capitalize text-xs font-medium rounded-full ${
                            entry.user_name === user
                              ? "bg-gray-100 text-gray-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {entry.user_display_name || entry.user_name || user}
                        </span>
                        <button
                          // onClick={() => handleToggleExpand(entry.id)}
                          className="px-3 py-1.5 text-sm font-medium text-[#008eff] hover:bg-[#008eff]/10 rounded-md transition-colors"
                        >
                          {isExpanded ? "Sluiten" : "Bewerken"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div>
                          <Alarm size={24} />
                        </div>
                        <span className="text-base  text-gray-700">
                          {entry ? entry.project_name : "-"}
                        </span>
                        {entry.has_activities && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newSet = new Set(expandedActivities);
                              if (newSet.has(entry.id)) {
                                newSet.delete(entry.id);
                              } else {
                                newSet.add(entry.id);
                                // Activities are already included in entry, but ensure they're in state
                                if (
                                  entry.activities &&
                                  !entryActivities[entry.id]
                                ) {
                                  setEntryActivities((prev) => ({
                                    ...prev,
                                    [entry.id]: entry.activities,
                                  }));
                                }
                              }
                              setExpandedActivities(newSet);
                            }}
                            className="ml-2 text-gray-500 hover:text-gray-700"
                          >
                            {expandedActivities.has(entry.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        )}
                      </div>
                      {/* <button
                        onClick={() => handleToggleExpand(entry.id)}
                        className="px-3 py-1.5 text-sm font-medium text-[#008eff] hover:bg-[#008eff]/10 rounded-md transition-colors"
                      >
                        {isExpanded ? "Sluiten" : "Bewerken"}
                      </button> */}
                    </div>

                    {!isExpanded ? (
                      // Collapsed View
                      <div className="space-y-2">
                        {entry.is_running === true && (
                          <div className="px-3 py-2 bg-[#008eff]/10 border border-[#008eff]/20 rounded-md">
                            <p className="text-sm font-medium text-[#008eff]">
                              ⏱️ Timer actief
                            </p>
                          </div>
                        )}
                        {/* First line: Times */}
                        <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 tracking-wide">
                              Start:
                            </span>
                            <span className="text-gray-900 font-medium">
                              {startTimeDisplay}
                            </span>
                          </div>
                          {entry.is_running !== true && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 tracking-wide">
                                Eind:
                              </span>
                              <span className="text-gray-900 font-medium">
                                {endTimeDisplay}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 tracking-wide">
                              Duur:
                            </span>
                            <span className="text-gray-900 font-medium">
                              {durationDisplay}
                            </span>
                          </div>
                        </div>
                        {/* Second line: Rates and total
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 tracking-wide">
                              Uurtarief:
                            </span>
                            <span className="text-gray-900 font-medium">
                              €{hourlyRateDisplay}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 tracking-wide">
                              Totaal:
                            </span>
                            <span className="text-gray-900 font-semibold">
                              {formatMoney(entryTotal)}
                            </span>
                          </div>
                        </div> */}

                        {/* Activity Breakdown - Collapsed View */}
                        {entry.has_activities &&
                          expandedActivities.has(entry.id) && (
                            <div className="mt-2 ml-6 space-y-1 border-l-2 border-gray-200 pl-3">
                              {(
                                entry.activities ||
                                entryActivities[entry.id] ||
                                []
                              ).map((activity) => {
                                const durationMs =
                                  activity.duration_ms ||
                                  (activity.end_time
                                    ? new Date(activity.end_time).getTime() -
                                      new Date(activity.start_time).getTime()
                                    : new Date().getTime() -
                                      new Date(activity.start_time).getTime());
                                const hours = durationMs / (1000 * 60 * 60);
                                const earnings = activity.hourly_rate
                                  ? hours * parseFloat(activity.hourly_rate)
                                  : 0;
                                return (
                                  <div
                                    key={activity.id}
                                    className="text-sm text-gray-600"
                                  >
                                    • {activity.activity_type} -{" "}
                                    {formatHoursMinutes(durationMs)}
                                    {earnings > 0 &&
                                      ` - ${formatMoney(earnings)}`}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    ) : (
                      // Expanded View
                      <div className="space-y-4">
                        {entry.is_running === true && (
                          <div className="mb-2 px-3 py-2 bg-[#008eff]/10 border border-[#008eff]/20 rounded-md">
                            <p className="text-sm font-medium text-[#008eff]">
                              ⏱️ Timer actief
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Projectnaam *
                          </label>
                          <select
                            value={
                              entry.project_editable !== undefined
                                ? entry.project_editable || ""
                                : entry.project_name || ""
                            }
                            onChange={(e) =>
                              handleEntryChange(
                                index,
                                "project_editable",
                                e.target.value || null
                              )
                            }
                            disabled={isSaving || isDeleting}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                            required
                          >
                            <option value="">Selecteer een project</option>
                            {projects
                              .filter((x) => x.status !== "archived")
                              .map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                  {project.is_default && " (Standaard)"}
                                  {project.is_shared && " (Gedeeld)"}
                                </option>
                              ))}
                          </select>
                        </div>

                        {(entry.project_editable || entry.project) && (
                          <>
                            {entry.is_running === true ? (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Starttijd
                                  </label>
                                  <input
                                    type="time"
                                    value={entry.start_time_editable || ""}
                                    onChange={(e) =>
                                      handleEntryChange(
                                        index,
                                        "start_time_editable",
                                        e.target.value
                                      )
                                    }
                                    disabled={isSaving || isDeleting}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Uurtarief (€)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={
                                      entry.hourly_rate_editable !== undefined
                                        ? entry.hourly_rate_editable
                                        : entry.hourly_rate || ""
                                    }
                                    onChange={(e) =>
                                      handleEntryChange(
                                        index,
                                        "hourly_rate_editable",
                                        e.target.value === ""
                                          ? ""
                                          : e.target.value
                                      )
                                    }
                                    disabled={
                                      isSaving ||
                                      isDeleting ||
                                      !entry.isProjectOwner // ✅ Disable if NOT owner
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Declarabel
                                  </label>
                                  <div className="flex gap-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`billable-${entry.id}`}
                                        checked={
                                          entry.billable_editable !== undefined
                                            ? entry.billable_editable === true
                                            : entry.billable !== false
                                        }
                                        onChange={() =>
                                          handleEntryChange(
                                            index,
                                            "billable_editable",
                                            true
                                          )
                                        }
                                        disabled={isSaving || isDeleting}
                                        className="w-4 h-4 text-[#008eff] border-gray-300 focus:ring-[#008eff] disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                      <span className="text-sm text-gray-700">
                                        Declarabel
                                      </span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`billable-${entry.id}`}
                                        checked={
                                          entry.billable_editable !== undefined
                                            ? entry.billable_editable === false
                                            : entry.billable === false
                                        }
                                        onChange={() =>
                                          handleEntryChange(
                                            index,
                                            "billable_editable",
                                            false
                                          )
                                        }
                                        disabled={isSaving || isDeleting}
                                        className="w-4 h-4 text-[#008eff] border-gray-300 focus:ring-[#008eff] disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                      <span className="text-sm text-gray-700">
                                        Niet declarabel
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between gap-6">
                                  <div className="flex-1 min-w-0 pr-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Starttijd
                                    </label>
                                    <input
                                      type="time"
                                      value={entry.start_time_editable || ""}
                                      onChange={(e) =>
                                        handleEntryChange(
                                          index,
                                          "start_time_editable",
                                          e.target.value
                                        )
                                      }
                                      disabled={isSaving || isDeleting}
                                      className="p-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Eindtijd
                                    </label>
                                    <input
                                      type="time"
                                      value={entry.end_time_editable || ""}
                                      onChange={(e) =>
                                        handleEntryChange(
                                          index,
                                          "end_time_editable",
                                          e.target.value
                                        )
                                      }
                                      disabled={isSaving || isDeleting}
                                      className="p-2 w-full  border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:grid sm:grid-cols-2 gap-4">
                                  <div className="flex-1 min-w-0">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Duur (U:MM)
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="0:00"
                                      value={entry.duration_editable || ""}
                                      onChange={(e) =>
                                        handleEntryChange(
                                          index,
                                          "duration_editable",
                                          e.target.value
                                        )
                                      }
                                      onBlur={() => handleDurationBlur(index)}
                                      pattern="[0-9]+:[0-5][0-9]"
                                      disabled={isSaving || isDeleting}
                                      className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Uurtarief (€)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={
                                        entry.hourly_rate_editable !== undefined
                                          ? entry.hourly_rate_editable
                                          : entry.hourly_rate || ""
                                      }
                                      onChange={(e) =>
                                        handleEntryChange(
                                          index,
                                          "hourly_rate_editable",
                                          e.target.value === ""
                                            ? ""
                                            : e.target.value
                                        )
                                      }
                                      disabled={
                                        isSaving ||
                                        isDeleting ||
                                        !entry.isProjectOwner // ✅ Disable if NOT owner
                                      }
                                      className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Declarabel
                                  </label>
                                  <div className="flex gap-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`billable-${entry.id}`}
                                        checked={
                                          entry.billable_editable !== undefined
                                            ? entry.billable_editable === true
                                            : entry.billable !== false
                                        }
                                        onChange={() =>
                                          handleEntryChange(
                                            index,
                                            "billable_editable",
                                            true
                                          )
                                        }
                                        disabled={isSaving || isDeleting}
                                        className="w-4 h-4 text-[#008eff] border-gray-300 focus:ring-[#008eff] disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                      <span className="text-sm text-gray-700">
                                        Declarabel
                                      </span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`billable-${entry.id}`}
                                        checked={
                                          entry.billable_editable !== undefined
                                            ? entry.billable_editable === false
                                            : entry.billable === false
                                        }
                                        onChange={() =>
                                          handleEntryChange(
                                            index,
                                            "billable_editable",
                                            false
                                          )
                                        }
                                        disabled={isSaving || isDeleting}
                                        className="w-4 h-4 text-[#008eff] border-gray-300 focus:ring-[#008eff] disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                      <span className="text-sm text-gray-700">
                                        Niet declarabel
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}

                        {/* Activities Section */}
                        {entry.has_activities &&
                          entry.id &&
                          !entry.id.startsWith("temp-") && (
                            <div className="pt-4 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-3">
                                <label className="block text-sm font-medium text-gray-700">
                                  Activiteiten
                                </label>
                              </div>
                              {(
                                entry.activities ||
                                entryActivities[entry.id] ||
                                []
                              ).length > 0 ? (
                                <div className="space-y-3">
                                  {(
                                    entry.activities ||
                                    entryActivities[entry.id] ||
                                    []
                                  ).map((activity) => {
                                    const isEditing =
                                      editingActivityId === activity.id;
                                    const activityData = isEditing
                                      ? editingActivityData
                                      : null;
                                    const durationMs =
                                      activity.duration_ms ||
                                      (activity.end_time
                                        ? new Date(
                                            activity.end_time
                                          ).getTime() -
                                          new Date(
                                            activity.start_time
                                          ).getTime()
                                        : new Date().getTime() -
                                          new Date(
                                            activity.start_time
                                          ).getTime());
                                    const hours = durationMs / (1000 * 60 * 60);
                                    const earnings = activity.hourly_rate
                                      ? hours * parseFloat(activity.hourly_rate)
                                      : 0;

                                    return (
                                      <div
                                        key={activity.id}
                                        className="border border-gray-200 rounded-md p-3 bg-gray-50"
                                      >
                                        {isEditing ? (
                                          <div className="space-y-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Activiteit type
                                              </label>
                                              <input
                                                type="text"
                                                value={
                                                  activityData?.activity_type ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  setEditingActivityData({
                                                    ...activityData,
                                                    activity_type:
                                                      e.target.value,
                                                  })
                                                }
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
                                                placeholder="Bijv. Work, Lunch"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                  Starttijd
                                                </label>
                                                <input
                                                  type="time"
                                                  value={
                                                    activityData?.start_time ||
                                                    ""
                                                  }
                                                  onChange={(e) =>
                                                    setEditingActivityData({
                                                      ...activityData,
                                                      start_time:
                                                        e.target.value,
                                                    })
                                                  }
                                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                  Eindtijd
                                                </label>
                                                <input
                                                  type="time"
                                                  value={
                                                    activityData?.end_time || ""
                                                  }
                                                  onChange={(e) =>
                                                    setEditingActivityData({
                                                      ...activityData,
                                                      end_time: e.target.value,
                                                    })
                                                  }
                                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Uurtarief (€)
                                              </label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={
                                                  activityData?.hourly_rate ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  setEditingActivityData({
                                                    ...activityData,
                                                    hourly_rate:
                                                      e.target.value === ""
                                                        ? null
                                                        : parseFloat(
                                                            e.target.value
                                                          ),
                                                  })
                                                }
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
                                                placeholder="0.00"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                                Declarabel
                                              </label>
                                              <div className="flex gap-4">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                  <input
                                                    type="radio"
                                                    name={`activity-billable-${activity.id}`}
                                                    checked={
                                                      activityData?.billable !==
                                                      false
                                                    }
                                                    onChange={() =>
                                                      setEditingActivityData({
                                                        ...activityData,
                                                        billable: true,
                                                      })
                                                    }
                                                    className="w-3 h-3 text-[#008eff] border-gray-300 focus:ring-[#008eff]"
                                                  />
                                                  <span className="text-xs text-gray-700">
                                                    Declarabel
                                                  </span>
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                  <input
                                                    type="radio"
                                                    name={`activity-billable-${activity.id}`}
                                                    checked={
                                                      activityData?.billable ===
                                                      false
                                                    }
                                                    onChange={() =>
                                                      setEditingActivityData({
                                                        ...activityData,
                                                        billable: false,
                                                      })
                                                    }
                                                    className="w-3 h-3 text-[#008eff] border-gray-300 focus:ring-[#008eff]"
                                                  />
                                                  <span className="text-xs text-gray-700">
                                                    Niet declarabel
                                                  </span>
                                                </label>
                                              </div>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                              <button
                                                onClick={() => {
                                                  // Preserve original date, update time
                                                  let startTimeISO =
                                                    activityData.original_start_time;
                                                  let endTimeISO =
                                                    activityData.original_end_time;

                                                  if (
                                                    activityData.start_time &&
                                                    activityData.original_start_time
                                                  ) {
                                                    const originalDate =
                                                      new Date(
                                                        activityData.original_start_time
                                                      );
                                                    const [hours, minutes] =
                                                      activityData.start_time.split(
                                                        ":"
                                                      );
                                                    originalDate.setHours(
                                                      parseInt(hours, 10) || 0,
                                                      parseInt(minutes, 10) ||
                                                        0,
                                                      0,
                                                      0
                                                    );
                                                    startTimeISO =
                                                      originalDate.toISOString();
                                                  }

                                                  if (
                                                    activityData.end_time &&
                                                    activityData.original_end_time
                                                  ) {
                                                    const originalDate =
                                                      new Date(
                                                        activityData.original_end_time
                                                      );
                                                    const [hours, minutes] =
                                                      activityData.end_time.split(
                                                        ":"
                                                      );
                                                    originalDate.setHours(
                                                      parseInt(hours, 10) || 0,
                                                      parseInt(minutes, 10) ||
                                                        0,
                                                      0,
                                                      0
                                                    );
                                                    endTimeISO =
                                                      originalDate.toISOString();
                                                  }

                                                  handleEditActivity(
                                                    entry.id,
                                                    activity.id,
                                                    {
                                                      activity_type:
                                                        activityData.activity_type,
                                                      hourly_rate:
                                                        activityData.hourly_rate,
                                                      billable:
                                                        activityData.billable,
                                                      start_time: startTimeISO,
                                                      end_time: endTimeISO,
                                                    }
                                                  );
                                                }}
                                                className="px-3 py-1.5 text-xs bg-[#008eff] text-white rounded-md hover:bg-[#0066b3]"
                                              >
                                                Opslaan
                                              </button>
                                              <button
                                                onClick={cancelEditingActivity}
                                                className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                              >
                                                Annuleren
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div>
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1">
                                                <div className="font-medium text-sm text-gray-900">
                                                  {activity.activity_type}
                                                </div>
                                                <div className="text-xs text-gray-600 mt-1">
                                                  {formatTime(
                                                    activity.start_time
                                                  )}
                                                  {activity.end_time
                                                    ? ` - ${formatTime(
                                                        activity.end_time
                                                      )}`
                                                    : " - Actief"}
                                                </div>
                                                <div className="text-xs text-gray-600 mt-1">
                                                  Duur:{" "}
                                                  {formatHoursMinutes(
                                                    durationMs
                                                  )}
                                                  {activity.hourly_rate && (
                                                    <>
                                                      {" • "}
                                                      {formatMoney(earnings)}
                                                    </>
                                                  )}
                                                </div>
                                                {activity.hourly_rate && (
                                                  <div className="text-xs text-gray-500 mt-1">
                                                    Tarief: €
                                                    {parseFloat(
                                                      activity.hourly_rate
                                                    ).toFixed(2)}
                                                    /uur
                                                  </div>
                                                )}
                                                <div className="text-xs text-gray-500 mt-1">
                                                  {activity.billable !== false
                                                    ? "Declarabel"
                                                    : "Niet declarabel"}
                                                </div>
                                              </div>
                                              <div className="flex gap-2 ml-2">
                                                <button
                                                  onClick={() =>
                                                    startEditingActivity(
                                                      activity
                                                    )
                                                  }
                                                  className="px-2 py-1 text-xs text-[#008eff] hover:bg-[#008eff]/10 rounded"
                                                  disabled={
                                                    isSaving || isDeleting
                                                  }
                                                >
                                                  Bewerken
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleDeleteActivity(
                                                      entry.id,
                                                      activity.id
                                                    )
                                                  }
                                                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                                                  disabled={
                                                    isSaving || isDeleting
                                                  }
                                                >
                                                  Verwijderen
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 py-2">
                                  Geen activiteiten gevonden
                                </div>
                              )}
                            </div>
                          )}

                        {/* Save button */}
                        <div className="pt-2 border-t border-gray-200 flex justify-end">
                          <button
                            onClick={() => handleSaveEntry(index)}
                            disabled={
                              isSaving ||
                              isDeleting ||
                              savingEntryId === entry.id ||
                              !entry.project_editable
                            }
                            className="px-4 w-full sm:w-auto py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {savingEntryId === entry.id
                              ? "Opslaan..."
                              : "Opslaan"}
                          </button>
                        </div>
                        {entry.id &&
                          !entry.id.startsWith("temp-") &&
                          entry.is_running !== true && (
                            <div className="pt-2 border-t border-gray-200">
                              <button
                                onClick={() =>
                                  handleDeleteEntry(entry.id, index)
                                }
                                disabled={isSaving || isDeleting}
                                className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                Verwijderen
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Entry Button */}
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 mt-4">
            <button
              onClick={handleAddEntry}
              disabled={isSaving || isDeleting}
              className="w-full sm:w-auto px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
            >
              <span>Tijdregistratie toevoegen</span>
            </button>
          </div>
        </div>

        {/* Expenses Tab */}
        <div
          className={`relative h-full overflow-y-auto ${
            activeTab === "expenses" ? "" : "hidden"
          }`}
        >
          {/* Expenses List */}
          {localExpenses.length === 0 ? (
            <p className="text-gray-500 text-center py-8 bg-white rounded-lg">
              Geen uitgaven gevonden voor deze dag
            </p>
          ) : (
            <div className="space-y-4 pt-4 pb-20">
              {localExpenses.map((expense, index) => {
                const isExpanded = expandedExpenses.has(expense.id);

                const project =
                  expense.project_editable || expense.project
                    ? projects.find(
                        (p) =>
                          p.id === (expense.project_editable || expense.project)
                      )
                    : null;

                const priceDisplay =
                  expense.price_editable !== undefined &&
                  expense.price_editable !== ""
                    ? parseFloat(expense.price_editable).toFixed(2)
                    : expense.price !== null && expense.price !== undefined
                    ? expense.price.toFixed(2)
                    : "-";

                const nameDisplay =
                  expense.name_editable || expense.name || "-";

                return (
                  <div
                    key={expense.id}
                    className="rounded-lg cursor-pointer border border-gray-200 p-4 space-y-4 bg-white transition-all duration-200"
                  >
                    <div
                      onClick={() => handleToggleExpandExpense(expense.id)}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span
                            className={`px-2 py-0.5 capitalize text-xs font-medium rounded-full ${
                              expense.user_name === user
                                ? "bg-gray-100 text-gray-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {expense.user_display_name}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // ✅ Prevent parent onClick from firing
                              handleToggleExpandExpense(expense.id);
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-[#008eff] hover:bg-[#008eff]/10 rounded-md transition-colors"
                          >
                            {isExpanded ? "Sluiten" : "Bewerken"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div>
                          <ToolBox size={24} />
                        </div>
                        <span className="text-base  text-gray-700">
                          {project ? project.name : "-"}
                        </span>
                      </div>
                    </div>

                    {!isExpanded ? (
                      // Collapsed View
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 tracking-wide">
                              Naam:
                            </span>
                            <span className="text-gray-900 font-medium">
                              {nameDisplay}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 tracking-wide">
                              Prijs:
                            </span>
                            <span className="text-gray-900 font-medium">
                              €{priceDisplay}
                            </span>
                          </div>
                          {expense.includes_vat_editable ||
                          expense.includes_vat ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 tracking-wide">
                                BTW:
                              </span>
                              <span className="text-gray-900 font-medium">
                                Inclusief
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      // Expanded View
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Projectnaam *
                          </label>
                          <select
                            value={
                              expense.project_editable !== undefined
                                ? expense.project_editable || ""
                                : expense.project || ""
                            }
                            onChange={(e) =>
                              handleExpenseChange(
                                index,
                                "project_editable",
                                e.target.value || null
                              )
                            }
                            disabled={isSaving || isDeleting}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                            required
                          >
                            <option value="">Selecteer een project</option>
                            {projects
                              .filter(
                                (x) =>
                                  x.status !== "archived" && x.archived !== true
                              )
                              .map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}

                                  {project.is_default && " (Standaard)"}
                                  {project.is_shared && " (Gedeeld)"}
                                </option>
                              ))}
                          </select>
                        </div>

                        {(expense.project_editable || expense.project) && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Naam *
                              </label>
                              <input
                                type="text"
                                value={expense.name_editable || ""}
                                onChange={(e) =>
                                  handleExpenseChange(
                                    index,
                                    "name_editable",
                                    e.target.value
                                  )
                                }
                                disabled={isSaving || isDeleting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Bijv. Materialen, Lunch, etc."
                                required
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row sm:grid sm:grid-cols-2 gap-4">
                              <div className="flex-1 min-w-0">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Prijs (€) *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={expense.price_editable || ""}
                                  onChange={(e) =>
                                    handleExpenseChange(
                                      index,
                                      "price_editable",
                                      e.target.value === ""
                                        ? ""
                                        : e.target.value
                                    )
                                  }
                                  disabled={isSaving || isDeleting}
                                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                  required
                                />
                              </div>

                              <div className="flex items-end sm:flex-1 min-w-0">
                                <label className="flex items-center space-x-2 cursor-pointer w-full">
                                  <input
                                    type="checkbox"
                                    checked={
                                      expense.includes_vat_editable || false
                                    }
                                    onChange={(e) =>
                                      handleExpenseChange(
                                        index,
                                        "includes_vat_editable",
                                        e.target.checked
                                      )
                                    }
                                    disabled={isSaving || isDeleting}
                                    className="w-4 h-4 text-[#008eff] border-gray-300 rounded focus:ring-[#008eff] disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span className="text-sm font-medium text-gray-700">
                                    Inclusief BTW
                                  </span>
                                </label>
                              </div>
                            </div>
                          </>
                        )}
                        {/* Save button */}
                        <div className="pt-2 border-t border-gray-200 flex justify-end">
                          <button
                            onClick={() => handleSaveExpense(index)}
                            disabled={
                              isSaving ||
                              isDeleting ||
                              savingExpenseId === expense.id ||
                              !expense.project_editable ||
                              !expense.name_editable ||
                              !expense.price_editable
                            }
                            className="px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {savingExpenseId === expense.id
                              ? "Opslaan..."
                              : "Opslaan"}
                          </button>
                        </div>
                        {expense.id &&
                          !expense.id.startsWith("temp-expense-") && (
                            <div className="pt-2 border-t border-gray-200">
                              <button
                                onClick={() =>
                                  handleDeleteExpense(expense.id, index)
                                }
                                disabled={isSaving || isDeleting}
                                className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                Verwijderen
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Expense Button */}
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 mt-4">
            <button
              onClick={handleAddExpense}
              disabled={isSaving || isDeleting}
              className="w-full sm:w-auto px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
            >
              <span>Uitgave toevoegen</span>
            </button>
          </div>
        </div>

        {/* Notes Tab */}
        <div
          className={`h-full overflow-y-auto ${
            activeTab === "notes" ? "" : "hidden"
          }`}
        >
          {loadingNotes ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff] mx-auto"></div>
              <p className="mt-4 text-gray-600">Notities laden...</p>
            </div>
          ) : notesError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {notesError}
            </div>
          ) : notes.length === 0 ? (
            <p className="text-gray-500 text-center py-8 bg-white rounded-lg">
              Geen notities gevonden voor deze dag
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const project = note.project_id
                  ? projects.find((p) => p.id === note.project_id)
                  : null;

                return (
                  <Link
                    key={note.id}
                    href={`/my/notes/${note.id}`}
                    className="block bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {note.name}
                        </h3>
                        {project && (
                          <p className="text-xs text-gray-500 mt-1">
                            {project.project_name}
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 shrink-0 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
