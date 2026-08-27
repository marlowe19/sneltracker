// lib/logic/utils/entryMapper.ts
// Ported 1:1 from sneltrack/lib/utils/entryMapper.js
import { computeEntryDurationMs } from "../time.ts";
import { formatTime, formatHoursMinutes } from "../dateRangeUtils.ts";

export interface RawTimeEntry {
  id: string;
  start_time: string;
  end_time?: string | null;
  duration_ms?: number | null;
  hourly_rate?: number | null;
  project_id?: string | null;
  billable?: boolean | null;
  [key: string]: unknown;
}

export interface EditableTimeEntry extends RawTimeEntry {
  start_time_editable: string;
  end_time_editable: string;
  duration_editable: string;
  hourly_rate_editable: number | string;
  project_editable: string;
  billable_editable: boolean;
}

export function mapEntryToEditable(entry: RawTimeEntry): EditableTimeEntry {
  const durationMs =
    entry.duration_ms ?? (entry.end_time ? computeEntryDurationMs(entry.start_time, entry.end_time, null) : null);

  return {
    ...entry,
    start_time_editable: formatTime(entry.start_time),
    end_time_editable: formatTime(entry.end_time ?? null),
    duration_editable: durationMs ? formatHoursMinutes(durationMs) : "",
    hourly_rate_editable: entry.hourly_rate ?? "",
    project_editable: entry.project_id ?? "", // Use project_id (UUID) directly
    billable_editable: entry.billable ?? true, // Default to billable
  };
}
