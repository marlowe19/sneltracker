"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/stores/useStore";
import { getWeekBounds, toIso } from "@/lib/time";
import { computeEntryDurationMs } from "@/lib/time";

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

  // Use local date components to avoid timezone issues
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
  // Parse "H:MM" or "HH:MM" format to milliseconds
  if (!durationString || durationString.trim() === "") return null;
  const parts = durationString.split(":");
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return (hours * 60 + minutes) * 60 * 1000;
}

function formatDurationInput(value) {
  // Remove any non-digit characters except colon
  let cleaned = value.replace(/[^\d:]/g, "");

  // Handle different input patterns
  if (!cleaned) return "";

  // If no colon, try to intelligently format
  if (!cleaned.includes(":")) {
    // "8" -> "8:00"
    // "830" -> "8:30"
    // "1230" -> "12:30"
    if (cleaned.length <= 2) {
      return `${cleaned}:00`;
    } else if (cleaned.length === 3) {
      // "830" -> "8:30"
      return `${cleaned[0]}:${cleaned.slice(1)}`;
    } else {
      // "1230" -> "12:30"
      return `${cleaned.slice(0, -2)}:${cleaned.slice(-2)}`;
    }
  }

  // Has colon, validate and format
  const parts = cleaned.split(":");
  if (parts.length > 2) {
    // Multiple colons, keep first two parts
    return `${parts[0]}:${parts[1]}`;
  }

  const [hoursStr, minutesStr] = parts;
  const hours = parseInt(hoursStr, 10) || 0;
  let minutes = parseInt(minutesStr || "0", 10) || 0;

  // Limit minutes to 59
  if (minutes > 59) {
    minutes = 59;
  }

  // Format minutes with leading zero if needed
  const formattedMinutes = String(minutes).padStart(2, "0");

  return `${hours}:${formattedMinutes}`;
}

export default function DayEntriesModalClient({
  isOpen,
  onClose,
  dayDate,
  entries,
  user,
}) {
  const router = useRouter();
  const projects = useStore((state) => state.projects);
  const addEntry = useStore((state) => state.addEntry);
  const updateEntry = useStore((state) => state.updateEntry);
  const replaceTempEntry = useStore((state) => state.replaceTempEntry);
  const deleteEntry = useStore((state) => state.deleteEntry);
  const fetchWeekEntries = useStore((state) => state.fetchWeekEntries);
  const expenses = useStore((state) => state.expenses);
  const fetchDayExpenses = useStore((state) => state.fetchDayExpenses);
  const addExpense = useStore((state) => state.addExpense);
  const updateExpense = useStore((state) => state.updateExpense);
  const replaceTempExpense = useStore((state) => state.replaceTempExpense);
  const deleteExpense = useStore((state) => state.deleteExpense);
  const weekOffset = useStore((state) => state.weekOffset);
  const loadingExpenses = useStore((state) => state.loadingExpenses);
  const expensesError = useStore((state) => state.expensesError);
  const [localEntries, setLocalEntries] = useState([]);
  const [localExpenses, setLocalExpenses] = useState([]);
  const [membersCache, setMembersCache] = useState({}); // Cache members by projectId
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("entries");

  // Extract dayDate string for dependency array
  const dayDateString = dayDate?.toISOString();

  useEffect(() => {
    if (isOpen && dayDate && !loadingExpenses && !expensesError) {
      fetchDayExpenses(user, dayDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dayDateString, user]);

  useEffect(() => {
    if (isOpen && entries && dayDate) {
      // Initialize local state with entries, sorted by created_at descending (newest first)
      const sortedEntries = [...entries].sort((a, b) => {
        const dateA = new Date(a.created_at || a.modified_at || 0);
        const dateB = new Date(b.created_at || b.modified_at || 0);
        return dateB - dateA; // Descending order
      });

      setLocalEntries(
        sortedEntries.map((entry) => {
          // Use duration_ms if available, otherwise calculate from start/end
          const durationMs =
            entry.duration_ms ??
            (entry.end_time
              ? computeEntryDurationMs(entry.start_time, entry.end_time, null)
              : null);

          return {
            ...entry,
            // Convert to editable format
            start_time_editable: formatTime(entry.start_time),
            end_time_editable: formatTime(entry.end_time),
            duration_editable: durationMs ? formatHoursMinutes(durationMs) : "",
            hourly_rate_editable: entry.hourly_rate ?? "",
            project_editable: entry.project ?? "",
          };
        })
      );
      setError(null);
    }
  }, [isOpen, entries, dayDate]);

  useEffect(() => {
    if (isOpen && expenses && dayDate) {
      // Initialize local state with expenses, sorted by created_at descending (newest first)
      const sortedExpenses = [...expenses].sort((a, b) => {
        const dateA = new Date(a.created_at || a.modified_at || 0);
        const dateB = new Date(b.created_at || b.modified_at || 0);
        return dateB - dateA; // Descending order
      });

      setLocalExpenses(
        sortedExpenses.map((expense) => ({
          ...expense,
          // Convert to editable format
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
  }, [isOpen, expenses, dayDate]);

  const handleEntryChange = async (index, field, value) => {
    const updated = [...localEntries];
    updated[index] = { ...updated[index], [field]: value };

    // If project changed, check if it's a shared project and auto-populate member rate
    if (field === "project_editable" && value) {
      const selectedProject = projects.find((p) => p.id === value);
      if (selectedProject && selectedProject.is_shared) {
        // Check cache first
        if (membersCache[value]) {
          const members = membersCache[value];
          const currentUserMember = members.find((m) => m.user_name === user);
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
          // Fetch project members to get the current user's hourly rate
          try {
            const res = await fetch(
              `/${encodeURIComponent(
                user
              )}/projecten/api?action=members&projectId=${value}`
            );
            const data = await res.json();
            const members = data.members || [];
            // Cache the members
            setMembersCache((prev) => ({ ...prev, [value]: members }));
            const currentUserMember = members.find((m) => m.user_name === user);
            if (
              currentUserMember &&
              currentUserMember.hourly_rate !== null &&
              currentUserMember.hourly_rate !== undefined
            ) {
              updated[index].hourly_rate_editable = String(
                currentUserMember.hourly_rate
              );
            } else if (selectedProject.hourly_rate) {
              // Fall back to project rate if member rate not set
              updated[index].hourly_rate_editable = String(
                selectedProject.hourly_rate
              );
            }
          } catch (error) {
            console.error("Error fetching member rate:", error);
            // If fetch fails, try project rate
            if (selectedProject.hourly_rate) {
              updated[index].hourly_rate_editable = String(
                selectedProject.hourly_rate
              );
            }
          }
        }
      } else if (selectedProject && selectedProject.hourly_rate) {
        // For non-shared projects, use project rate
        updated[index].hourly_rate_editable = String(
          selectedProject.hourly_rate
        );
      }
    }

    // If duration changed, just store the raw value (no formatting while typing)
    // Formatting will happen on blur

    // If start_time or end_time changed, recalculate duration (but don't overwrite duration_ms)
    if (field === "start_time_editable" || field === "end_time_editable") {
      if (
        updated[index].start_time_editable &&
        updated[index].end_time_editable &&
        dayDate
      ) {
        const start = combineDayDateWithTime(
          dayDate,
          updated[index].start_time_editable
        );
        const end = combineDayDateWithTime(
          dayDate,
          updated[index].end_time_editable
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
      // Format on blur to ensure proper format
      const formatted = formatDurationInput(value);
      updated[index].duration_editable = formatted;
      setLocalEntries(updated);
    }
  };

  const handleAddEntry = () => {
    if (!dayDate) return;

    // Create a new entry in local state only (will be created in backend on save)
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
    };

    // Add new entry at the beginning (newest first)
    setLocalEntries([newEntry, ...localEntries]);
  };

  const handleExpenseChange = (index, field, value) => {
    const updated = [...localExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setLocalExpenses(updated);
  };

  const handleAddExpense = () => {
    if (!dayDate) return;

    // Create a new expense in local state only (will be created in backend on save)
    const tempId = `temp-expense-${Date.now()}-${Math.random()}`;
    const newExpense = {
      id: tempId,
      user_name: user,
      project: null,
      name: "",
      price: null,
      includes_vat: false,
      expense_type: "materials",
      date: dayDate.toISOString(),
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      name_editable: "",
      price_editable: "",
      project_editable: "",
      includes_vat_editable: false,
    };

    // Add new expense at the beginning (newest first)
    setLocalExpenses([newExpense, ...localExpenses]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Process each entry
      const updatePromises = localEntries.map(async (entry) => {
        // Check if this is a new entry (has temp ID)
        const isNewEntry = entry.id && entry.id.startsWith("temp-");

        if (isNewEntry) {
          // Create new entry in backend
          if (!dayDate) {
            throw new Error("Day date is required");
          }

          const updates = {};
          let durationWasEdited = false;

          // Check if duration was edited
          if (
            entry.duration_editable !== undefined &&
            entry.duration_editable !== ""
          ) {
            const newDurationMs = parseDuration(entry.duration_editable);
            if (newDurationMs !== null) {
              updates.duration_ms = newDurationMs;
              durationWasEdited = true;
            }
          }

          // If duration was edited, calculate start_time and end_time from the day
          if (durationWasEdited && dayDate && updates.duration_ms) {
            // Set start_time to start of the selected day using local date components
            const date = new Date(dayDate);
            const dayStart = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              0,
              0,
              0,
              0
            );

            // Calculate end_time from start_time + duration
            const dayEnd = new Date(dayStart.getTime() + updates.duration_ms);

            updates.start_time = dayStart.toISOString();
            updates.end_time = dayEnd.toISOString();
          } else {
            // Use start_time and end_time if provided
            if (entry.start_time_editable && dayDate) {
              const newStart = combineDayDateWithTime(
                dayDate,
                entry.start_time_editable
              );
              if (newStart) {
                updates.start_time = newStart.toISOString();
              }
            }

            if (entry.end_time_editable && dayDate) {
              const newEnd = combineDayDateWithTime(
                dayDate,
                entry.end_time_editable
              );
              if (newEnd) {
                updates.end_time = newEnd.toISOString();
              }
            }
          }

          // Set hourly_rate if provided
          if (
            entry.hourly_rate_editable !== undefined &&
            entry.hourly_rate_editable !== ""
          ) {
            updates.hourly_rate = parseFloat(entry.hourly_rate_editable);
          }

          // Set project if provided
          if (
            entry.project_editable !== undefined &&
            entry.project_editable !== ""
          ) {
            updates.project = entry.project_editable;
          }

          // Create entry in backend
          const response = await fetch(`/${encodeURIComponent(user)}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayDate: dayDate.toISOString(),
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

          // Parse response and replace temp entry with real entry
          const responseData = await response.json();
          if (responseData.entry) {
            replaceTempEntry(entry.id, responseData.entry);
          }

          return { success: true }; // New entry created
        }

        // Existing entry - update it
        const updates = {};
        let durationWasEdited = false;

        // Check if duration was edited
        if (
          entry.duration_editable !== undefined &&
          entry.duration_editable !== ""
        ) {
          const newDurationMs = parseDuration(entry.duration_editable);
          const currentDurationMs = entry.duration_ms;

          if (newDurationMs !== null && newDurationMs !== currentDurationMs) {
            updates.duration_ms = newDurationMs;
            durationWasEdited = true;
          }
        }

        // If duration was edited, calculate start_time and end_time from the day
        if (durationWasEdited && dayDate && updates.duration_ms) {
          // Set start_time to start of the selected day using local date components
          const date = new Date(dayDate);
          const dayStart = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          );

          // Calculate end_time from start_time + duration
          const dayEnd = new Date(dayStart.getTime() + updates.duration_ms);

          updates.start_time = dayStart.toISOString();
          updates.end_time = dayEnd.toISOString();
        } else {
          // Update start_time if changed (and duration wasn't edited)
          if (entry.start_time_editable && !durationWasEdited && dayDate) {
            const newStart = combineDayDateWithTime(
              dayDate,
              entry.start_time_editable
            );
            if (newStart && newStart.toISOString() !== entry.start_time) {
              updates.start_time = newStart.toISOString();
            }
          }

          // Update end_time if changed (and duration wasn't edited)
          if (entry.end_time_editable && !durationWasEdited && dayDate) {
            const newEnd = combineDayDateWithTime(
              dayDate,
              entry.end_time_editable
            );
            const currentEnd = entry.end_time
              ? new Date(entry.end_time).toISOString()
              : null;
            if (newEnd && newEnd.toISOString() !== currentEnd) {
              updates.end_time = newEnd.toISOString();
            }
          } else if (
            !entry.end_time_editable &&
            entry.end_time &&
            !durationWasEdited
          ) {
            // Handle clearing end_time (shouldn't happen for closed entries, but handle it)
            updates.end_time = null;
          }
        }

        // Update hourly_rate if changed
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

        // Update project if changed
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

        // Only make API call if there are updates
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

          // Parse response and update store with full entry object
          const responseData = await response.json();
          if (responseData.entry) {
            updateEntry(entry.id, responseData.entry);
          }

          return { success: true };
        }

        return { success: true }; // No updates needed
      });

      await Promise.all(updatePromises);

      // Process each expense
      const expensePromises = localExpenses.map(async (expense) => {
        // Check if this is a new expense (has temp ID)
        const isNewExpense =
          expense.id && expense.id.startsWith("temp-expense-");

        if (isNewExpense) {
          // Create new expense in backend
          if (!dayDate) {
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
                dayDate: dayDate.toISOString(),
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

          // Parse response and replace temp expense with real expense
          const responseData = await response.json();
          if (responseData.expense) {
            replaceTempExpense(expense.id, responseData.expense);
          }

          return { success: true };
        }

        // Existing expense - update it
        const updates = {};

        // Update name if changed
        if (expense.name_editable !== undefined) {
          const newName = expense.name_editable.trim();
          if (newName !== expense.name) {
            updates.name = newName;
          }
        }

        // Update price if changed
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

        // Update includes_vat if changed
        if (expense.includes_vat_editable !== undefined) {
          const newIncludesVat = Boolean(expense.includes_vat_editable);
          const currentIncludesVat = expense.includes_vat ?? false;
          if (newIncludesVat !== currentIncludesVat) {
            updates.includes_vat = newIncludesVat;
          }
        }

        // Update project if changed
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

        // Only make API call if there are updates
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

          // Parse response and update store with full expense object
          const responseData = await response.json();
          if (responseData.expense) {
            updateExpense(expense.id, responseData.expense);
          }

          return { success: true };
        }

        return { success: true }; // No updates needed
      });

      await Promise.all(expensePromises);

      // Show success message
      setSuccessMessage("Wijzigingen opgeslagen");
      setIsSaving(false);

      // Wait briefly to show success message, then close modal
      setTimeout(() => {
        handleCancel();
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to save changes");
      setIsSaving(false);
      // Keep modal open on error so user can retry
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

      // Optimistically delete from store
      deleteEntry(entryId);

      // Remove from local state immediately
      const updated = localEntries.filter((_, i) => i !== index);
      setLocalEntries(updated);
      setIsDeleting(false);

      // Refetch week entries to get updated data
      const referenceDate = new Date(
        new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000
      );
      const { start: weekStart, end: weekEnd } = getWeekBounds(referenceDate);
      await fetchWeekEntries(user, toIso(weekStart), toIso(weekEnd));

      // Refresh router for active timers
      router.refresh();

      // If no entries left, close drawer
      if (updated.length === 0) {
        handleCancel();
      }
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

      // Optimistically delete from store
      deleteExpense(expenseId);

      // Remove from local state immediately
      const updated = localExpenses.filter((_, i) => i !== index);
      setLocalExpenses(updated);
      setIsDeleting(false);

      // Refetch day expenses
      await fetchDayExpenses(user, dayDate);
    } catch (err) {
      setError(err.message || "Failed to delete expense");
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setLocalEntries([]);
    setLocalExpenses([]);
    setError(null);
    setSuccessMessage(null);
    setIsSaving(false);
    setIsDeleting(false);
    setActiveTab("entries");
    onClose();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Calculate summary totals for entries
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

  // Calculate summary totals for expenses
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

  const dayDateFormatted = dayDate
    ? dayDate.toLocaleDateString("nl-NL", {
        weekday: "short",
        year: "2-digit",
        month: "short",
        day: "numeric",
      })
    : "";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300"
      onClick={handleCancel}
    >
      <div
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl shadow-2xl h-full flex flex-col transition-transform duration-300 ease-out translate-y-0 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white z-10 border-b border-gray-200 shrink-0">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg sm:text-base font-semibold text-gray-900">
              Bewerk entries - {dayDateFormatted}
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleTabChange("entries")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "entries"
                  ? "text-[#008eff] border-b-2 border-[#008eff]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Tijdregistraties
            </button>
            <button
              onClick={() => handleTabChange("expenses")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "expenses"
                  ? "text-[#008eff] border-b-2 border-[#008eff]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Uitgaven
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f2f2f2]">
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
                aria-label="Entry toevoegen"
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
                {localEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="rounded-lg p-4 space-y-4 bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">
                        Entry {index + 1}
                      </div>
                      {entry.id &&
                        !entry.id.startsWith("temp-") &&
                        entry.is_running !== true && (
                          <button
                            onClick={() => handleDeleteEntry(entry.id, index)}
                            disabled={isSaving || isDeleting}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            aria-label="Entry verwijderen"
                          >
                            Verwijderen
                          </button>
                        )}
                    </div>

                    <div className="space-y-4">
                      {entry.is_running === true ? (
                        <div className="py-4 text-center">
                          <p className="text-lg font-semibold text-[#008eff]">
                            Timer actief
                          </p>
                        </div>
                      ) : (
                        <>
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

                          {/* Only show other fields if project is selected */}
                          {(entry.project_editable || entry.project) && (
                            <>
                              <div className="grid grid-cols-2 gap-4">
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
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
                                    disabled={isSaving || isDeleting}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
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
                aria-label="Uitgave toevoegen"
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
                      {expense.id &&
                        !expense.id.startsWith("temp-expense-") && (
                          <button
                            onClick={() =>
                              handleDeleteExpense(expense.id, index)
                            }
                            disabled={isSaving || isDeleting}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            aria-label="Uitgave verwijderen"
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

                      {/* Only show other fields if project is selected */}
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

                          <div className="grid grid-cols-2 gap-4">
                            <div>
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                required
                              />
                            </div>

                            <div className="flex items-end">
                              <label className="flex items-center space-x-2 cursor-pointer">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white z-10 border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end gap-3 shrink-0">
          <button
            onClick={handleCancel}
            disabled={isSaving || isDeleting}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              isDeleting ||
              (localEntries.length === 0 && localExpenses.length === 0)
            }
            className="px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
