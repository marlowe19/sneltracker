import { computeEntryDurationMs } from "@/lib/time";
import { formatTime, formatHoursMinutes } from "@/lib/dateRangeUtils";

export function mapEntryToEditable(entry) {
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
    project_editable: entry.project_id ?? "", // ✅ Use project_id (UUID) directly
    billable_editable: entry.billable ?? true, // Default to billable
  };
}
