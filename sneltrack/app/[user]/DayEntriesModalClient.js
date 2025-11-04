"use client";

import { useState, useEffect } from "react";
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
  const date = new Date(dayDate);
  date.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
  return date;
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
  const [localEntries, setLocalEntries] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`);
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error("Error loading projects:", error);
      }
    }
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && entries && dayDate) {
      // Initialize local state with entries
      setLocalEntries(
        entries.map((entry) => {
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

  if (!isOpen) return null;

  const handleEntryChange = async (index, field, value) => {
    const updated = [...localEntries];
    updated[index] = { ...updated[index], [field]: value };

    // If project changed, check if it's a shared project and auto-populate member rate
    if (field === "project_editable" && value) {
      const selectedProject = projects.find((p) => p.id === value);
      if (selectedProject && selectedProject.is_shared) {
        try {
          // Fetch project members to get the current user's hourly rate
          const res = await fetch(
            `/${encodeURIComponent(
              user
            )}/projecten/api?action=members&projectId=${value}`
          );
          const data = await res.json();
          const members = data.members || [];
          const currentUserMember = members.find((m) => m.user_name === user);
          if (currentUserMember && currentUserMember.hourly_rate !== null && currentUserMember.hourly_rate !== undefined) {
            updated[index].hourly_rate_editable = String(currentUserMember.hourly_rate);
          } else if (selectedProject.hourly_rate) {
            // Fall back to project rate if member rate not set
            updated[index].hourly_rate_editable = String(selectedProject.hourly_rate);
          }
        } catch (error) {
          console.error("Error fetching member rate:", error);
          // If fetch fails, try project rate
          if (selectedProject.hourly_rate) {
            updated[index].hourly_rate_editable = String(selectedProject.hourly_rate);
          }
        }
      } else if (selectedProject && selectedProject.hourly_rate) {
        // For non-shared projects, use project rate
        updated[index].hourly_rate_editable = String(selectedProject.hourly_rate);
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

  const handleAddEntry = async () => {
    if (!dayDate) return;

    setIsSaving(true);
    setError(null);

    try {
      // Create a new entry for the selected day
      const response = await fetch(`/${encodeURIComponent(user)}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayDate: dayDate.toISOString(),
          duration_ms: null,
          hourly_rate: null,
          project: null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create entry");
      }

      const { entry } = await response.json();

      // Add the new entry to localEntries
      const durationMs =
        entry.duration_ms ??
        (entry.end_time
          ? computeEntryDurationMs(entry.start_time, entry.end_time, null)
          : null);

      const newEntry = {
        ...entry,
        start_time_editable: formatTime(entry.start_time),
        end_time_editable: formatTime(entry.end_time),
        duration_editable: durationMs ? formatHoursMinutes(durationMs) : "",
        hourly_rate_editable: entry.hourly_rate ?? "",
        project_editable: entry.project ?? "",
      };

      setLocalEntries([...localEntries, newEntry]);
      setIsSaving(false);
    } catch (err) {
      setError(err.message || "Failed to create entry");
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Update each entry
      const updatePromises = localEntries.map(async (entry) => {
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
          // Set start_time to start of the selected day
          const dayStart = new Date(dayDate);
          dayStart.setHours(0, 0, 0, 0);

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
        }
      });

      await Promise.all(updatePromises);

      // Close modal and refresh the page to show updated data
      handleCancel();
      window.location.reload();
    } catch (err) {
      setError(err.message || "Failed to save changes");
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalEntries([]);
    setError(null);
    setIsSaving(false);
    onClose();
  };

  const dayDateFormatted = dayDate
    ? dayDate.toLocaleDateString("nl-NL", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div
      className="fixed inset-0  bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white opacity-100 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Bewerk entries - {dayDateFormatted}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddEntry}
              disabled={isSaving}
              className="w-10 h-10 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-2xl font-bold"
              aria-label="Entry toevoegen"
            >
              +
            </button>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {localEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Geen entries gevonden voor deze dag
            </p>
          ) : (
            localEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg p-4 space-y-4"
              >
                <div className="text-sm font-medium text-gray-700">
                  Entry {index + 1}
                </div>

                <div className="space-y-4">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
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
                            e.target.value === "" ? "" : e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Projectnaam
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#008eff]"
                    >
                      <option value="">Geen project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                          {project.is_default && " (Standaard)"}
                          {project.is_shared && " (Gedeeld)"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || localEntries.length === 0}
            className="px-4 py-2 bg-[#008eff] text-white rounded-md hover:bg-[#0066b3] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
