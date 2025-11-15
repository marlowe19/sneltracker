"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/stores/useStore";
import { computeEntryDurationMs } from "@/lib/time";
import { useToast } from "@/app/components/Toast";
import NotificationBadge from "@/app/components/NotificationBadge";

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
  entries: initialEntries,
  expenses: initialExpenses,
  onEntryUpdate,
}) {
  const router = useRouter();
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
  const toast = useToast();
  const dayDateString = selectedDate?.toISOString();

  // Fetch day expenses
  useEffect(() => {
    if (selectedDate) {
      fetchDayExpenses(user, selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, user]);

  // Initialize entries
  useEffect(() => {
    if (initialEntries && selectedDate) {
      const sortedEntries = [...initialEntries].sort((a, b) => {
        const dateA = new Date(a.created_at || a.modified_at || 0);
        const dateB = new Date(b.created_at || b.modified_at || 0);
        return dateB - dateA;
      });

      const mappedEntries = sortedEntries.map((entry) => {
        const durationMs =
          entry.duration_ms ??
          (entry.end_time
            ? computeEntryDurationMs(entry.start_time, entry.end_time, null)
            : null);

        return {
          ...entry,
          start_time_editable: formatTime(entry.start_time),
          end_time_editable: formatTime(entry.end_time),
          duration_editable: durationMs ? formatHoursMinutes(durationMs) : "",
          hourly_rate_editable: entry.hourly_rate ?? "",
          project_editable: entry.project ?? "",
          isProjectMember: false,
        };
      });

      setLocalEntries(mappedEntries);

      // Automatically expand temp entries
      const tempEntryIds = mappedEntries
        .filter((entry) => entry.id && entry.id.startsWith("temp-"))
        .map((entry) => entry.id);
      if (tempEntryIds.length > 0) {
        setExpandedEntries((prev) => new Set([...prev, ...tempEntryIds]));
      }
    }
  }, [selectedDate]);

  // Initialize expenses
  useEffect(() => {
    if (expenses && selectedDate) {
      const sortedExpenses = [...expenses].sort((a, b) => {
        const dateA = new Date(a.created_at || a.modified_at || 0);
        const dateB = new Date(b.created_at || b.modified_at || 0);
        return dateB - dateA;
      });

      setLocalExpenses(
        sortedExpenses.map((expense) => ({
          ...expense,
          name_editable: expense.name ?? "",
          price_editable:
            expense.price !== null && expense.price !== undefined
              ? String(expense.price)
              : "",
          project_editable: expense.project ?? "",
          includes_vat_editable: expense.includes_vat ?? false,
        }))
      );
    }
  }, [expenses, selectedDate]);

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

        const url = new URL(
          `/${encodeURIComponent(user)}/notes/api`,
          window.location.origin
        );
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
  }, [selectedDate, user]);

  const handleEntryChange = async (index, field, value) => {
    const updated = [...localEntries];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "project_editable") {
      if (value) {
        const selectedProject = projects.find((p) => p.id === value);
        if (selectedProject && selectedProject.is_shared) {
          if (membersCache[value]) {
            const members = membersCache[value];
            const currentUserMember = members.find((m) => m.user_name === user);
            updated[index].isProjectMember = !!currentUserMember;
            if (
              currentUserMember &&
              currentUserMember.hourly_rate !== null &&
              currentUserMember.hourly_rate !== undefined
            ) {
              updated[index].hourly_rate_editable = String(
                currentUserMember.hourly_rate
              );
            } else if (selectedProject.hourly_rate) {
              updated[index].hourly_rate_editable = String(
                selectedProject.hourly_rate
              );
            }
          } else {
            try {
              const res = await fetch(
                `/${encodeURIComponent(
                  user
                )}/projecten/api?action=members&projectId=${value}`
              );
              const data = await res.json();
              const members = data.members || [];
              setMembersCache((prev) => ({ ...prev, [value]: members }));
              const currentUserMember = members.find(
                (m) => m.user_name === user
              );
              updated[index].isProjectMember = !!currentUserMember;
              if (
                currentUserMember &&
                currentUserMember.hourly_rate !== null &&
                currentUserMember.hourly_rate !== undefined
              ) {
                updated[index].hourly_rate_editable = String(
                  currentUserMember.hourly_rate
                );
              } else if (selectedProject.hourly_rate) {
                updated[index].hourly_rate_editable = String(
                  selectedProject.hourly_rate
                );
              }
            } catch (error) {
              console.error("Error fetching member rate:", error);
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
          if (selectedProject && selectedProject.hourly_rate) {
            updated[index].hourly_rate_editable = String(
              selectedProject.hourly_rate
            );
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
            updates.project = entry.project_editable;
          }

          const response = await fetch(`/${encodeURIComponent(user)}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayDate: selectedDate.toISOString(),
              duration_ms: updates.duration_ms ?? null,
              hourly_rate: updates.hourly_rate ?? null,
              project: updates.project ?? null,
              start_time: updates.start_time ?? null,
              end_time: updates.end_time ?? null,
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
          const currentProject = entry.project;
          if (newProject !== currentProject) {
            updates.project = newProject;
          }
        }

        if (Object.keys(updates).length > 0) {
          const response = await fetch(
            `/${encodeURIComponent(user)}/entries/${entry.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            }
          );

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

          const response = await fetch(
            `/${encodeURIComponent(user)}/expenses`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dayDate: selectedDate.toISOString(),
                project: expense.project_editable,
                name: expense.name_editable.trim(),
                price: parseFloat(expense.price_editable),
                includes_vat: expense.includes_vat_editable ?? false,
                expense_type: "materials",
              }),
            }
          );

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
          const response = await fetch(
            `/${encodeURIComponent(user)}/expenses/${expense.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            }
          );

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
      toast.success("Wijzigingen opgeslagen");
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
          updates.project = entry.project_editable;
        }

        const response = await fetch(`/${encodeURIComponent(user)}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayDate: selectedDate.toISOString(),
            duration_ms: updates.duration_ms ?? null,
            hourly_rate: updates.hourly_rate ?? null,
            project: updates.project ?? null,
            start_time: updates.start_time ?? null,
            end_time: updates.end_time ?? null,
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
            project_editable: responseData.entry.project ?? "",
            isProjectMember: updated[index].isProjectMember,
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
          const currentProject = entry.project;
          if (newProject !== currentProject) {
            updates.project = newProject;
          }
        }

        if (Object.keys(updates).length > 0) {
          const response = await fetch(
            `/${encodeURIComponent(user)}/entries/${entry.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            }
          );

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
              project_editable: responseData.entry.project ?? "",
              isProjectMember: updated[index].isProjectMember,
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

  const handleDeleteEntry = async (entryId, index) => {
    if (!confirm("Weet je zeker dat je deze entry wilt verwijderen?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/${encodeURIComponent(user)}/entries/${entryId}`,
        {
          method: "DELETE",
        }
      );

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
      const response = await fetch(
        `/${encodeURIComponent(user)}/expenses/${expenseId}`,
        {
          method: "DELETE",
        }
      );

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

  if (!selectedDate) return null;

  return (
    <div className="w-full">
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {dayDateFormatted}
          </h2>
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

      <div className="p-4 sm:p-6 ">
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
        <div className={activeTab === "entries" ? "" : "hidden"}>
          {/* Summary Bar */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Aantal entries
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {entrySummary.count}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Totaal uren
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {entrySummary.totalHours}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Totaal prijs
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    €{entrySummary.totalPrice}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Entry Button */}
          <div className="mb-4">
            <button
              onClick={handleAddEntry}
              disabled={isSaving || isDeleting}
              className="w-full sm:w-auto px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
            >
              <span className="text-xl">+</span>
              <span>Entry toevoegen</span>
            </button>
          </div>

          {/* Entries List */}
          {localEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8 bg-white rounded-lg">
              Geen entries gevonden voor deze dag
            </p>
          ) : (
            <div className="space-y-4">
              {localEntries.map((entry, index) => {
                const isExpanded = expandedEntries.has(entry.id);

                const project =
                  entry.project_editable || entry.project
                    ? projects.find(
                        (p) =>
                          p.id === (entry.project_editable || entry.project)
                      )
                    : null;

                console.log(
                  "Found project:",
                  project ? { id: project.id, name: project.name } : null
                );

                const entryTotal = calculateEntryTotal(entry);
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
                    key={entry.id}
                    className="rounded-lg border border-gray-200 p-4 space-y-4 bg-white transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {project ? project.name : "-"}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            entry.user_name === user
                              ? "bg-gray-100 text-gray-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {entry.user_name || user}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleExpand(entry.id)}
                        className="px-3 py-1.5 text-sm font-medium text-[#008eff] hover:bg-[#008eff]/10 rounded-md transition-colors"
                      >
                        {isExpanded ? "Sluiten" : "Bewerken"}
                      </button>
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
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                              Start:
                            </span>
                            <span className="text-gray-900 font-medium">
                              {startTimeDisplay}
                            </span>
                          </div>
                          {entry.is_running !== true && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 uppercase tracking-wide">
                                Eind:
                              </span>
                              <span className="text-gray-900 font-medium">
                                {endTimeDisplay}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">
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
                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                              Uurtarief:
                            </span>
                            <span className="text-gray-900 font-medium">
                              €{hourlyRateDisplay}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                              Totaal:
                            </span>
                            <span className="text-gray-900 font-semibold">
                              {formatMoney(entryTotal)}
                            </span>
                          </div>
                        </div> */}
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
                                : entry.project || ""
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
                            {projects.map((project) => (
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
                                      entry.isProjectMember
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex flex-col sm:flex-row sm:grid sm:grid-cols-2 gap-4">
                                  <div className="flex-1 min-w-0">
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
                                      className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
                                      className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        entry.isProjectMember
                                      }
                                      className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </>
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
                            className="px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
        </div>

        {/* Expenses Tab */}
        <div className={activeTab === "expenses" ? "" : "hidden"}>
          {/* Summary Bar */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Aantal uitgaven
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {expenseSummary.count}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Totaal prijs
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    €{expenseSummary.totalPrice}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Expense Button */}
          <div className="mb-4">
            <button
              onClick={handleAddExpense}
              disabled={isSaving || isDeleting}
              className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
            >
              <span className="text-xl">+</span>
              <span>Uitgave toevoegen</span>
            </button>
          </div>

          {/* Expenses List */}
          {localExpenses.length === 0 ? (
            <p className="text-gray-500 text-center py-8 bg-white rounded-lg">
              Geen uitgaven gevonden voor deze dag
            </p>
          ) : (
            <div className="space-y-4">
              {localExpenses.map((expense, index) => (
                <div
                  key={expense.id}
                  className="rounded-lg p-4 space-y-4 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">
                      Uitgave {index + 1}
                    </div>
                    {expense.id && !expense.id.startsWith("temp-expense-") && (
                      <button
                        onClick={() => handleDeleteExpense(expense.id, index)}
                        disabled={isSaving || isDeleting}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Verwijderen
                      </button>
                    )}
                  </div>

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
                        {projects.map((project) => (
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
                                  e.target.value === "" ? "" : e.target.value
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
                                checked={expense.includes_vat_editable || false}
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes Tab */}
        <div className={activeTab === "notes" ? "" : "hidden"}>
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
                    href={`/${encodeURIComponent(user)}/notes/${note.id}`}
                    className="block bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {note.name}
                        </h3>
                        {project && (
                          <p className="text-xs text-gray-500 mt-1">
                            {project.name}
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
