/**
 * Billable-only earnings from time entries and timer activities.
 * Unbillable time is tracked for reporting but must not increase earnings totals.
 */

export function isBillable(billable) {
  return billable !== false;
}

export function computeBillableMoney(durationMs, hourlyRate, billable = true) {
  if (!isBillable(billable) || !durationMs || durationMs <= 0 || hourlyRate == null) {
    return 0;
  }
  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return (durationMs / (1000 * 60 * 60)) * rate;
}

export function resolveEntryBillable(entry, { useEditableFields = false } = {}) {
  if (useEditableFields && entry.billable_editable !== undefined) {
    return isBillable(entry.billable_editable);
  }
  return isBillable(entry.billable);
}

export function resolveEntryHourlyRate(entry, { useEditableFields = false } = {}) {
  if (
    useEditableFields &&
    entry.hourly_rate_editable !== undefined &&
    entry.hourly_rate_editable !== ""
  ) {
    return parseFloat(entry.hourly_rate_editable);
  }
  return entry.hourly_rate;
}

export function computeEntryBillableMoney(entry, durationMs, options = {}) {
  return computeBillableMoney(
    durationMs,
    resolveEntryHourlyRate(entry, options),
    resolveEntryBillable(entry, options),
  );
}

export function getActivityDurationMs(activity, nowMs = Date.now()) {
  if (activity.duration_ms != null) return activity.duration_ms;
  if (!activity.start_time) return 0;
  const startMs = new Date(activity.start_time).getTime();
  const endMs = activity.end_time
    ? new Date(activity.end_time).getTime()
    : nowMs;
  return Math.max(0, endMs - startMs);
}

export function computeActivityBillableMoney(activity, nowMs = Date.now()) {
  return computeBillableMoney(
    getActivityDurationMs(activity, nowMs),
    activity.hourly_rate,
    activity.billable,
  );
}

export function computeActivitiesBillableMoney(activities, nowMs = Date.now()) {
  let total = 0;
  for (const activity of activities ?? []) {
    total += computeActivityBillableMoney(activity, nowMs);
  }
  return total;
}
