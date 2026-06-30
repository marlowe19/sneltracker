export const DEFAULT_BREAK_MINUTES = 30;

export function resolveProjectBreakMinutes(project) {
  const configured = project?.default_break_minutes;
  if (configured === null || configured === undefined) {
    return DEFAULT_BREAK_MINUTES;
  }
  return configured;
}

export function computeGrossDurationMs(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const gross = new Date(endTime).getTime() - new Date(startTime).getTime();
  return gross > 0 ? gross : 0;
}

export function computeBreakMs(breakMinutes, grossMs) {
  const minutes = Number(breakMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || grossMs <= 0) {
    return 0;
  }
  const breakMs = Math.round(minutes * 60 * 1000);
  return Math.min(breakMs, grossMs);
}

export function applyBreakToGross(grossMs, breakMinutes) {
  const breakMs = computeBreakMs(breakMinutes, grossMs);
  return {
    break_deduction_ms: breakMs > 0 ? breakMs : null,
    duration_ms: grossMs > 0 ? grossMs - breakMs : null,
  };
}

export function applyProjectDefaultBreakOnStop(grossMs, projectBreakSettings) {
  if (!projectBreakSettings?.default_break_enabled || grossMs <= 0) {
    return {
      break_deduction_ms: null,
      duration_ms: grossMs > 0 ? grossMs : null,
    };
  }

  return applyBreakToGross(
    grossMs,
    resolveProjectBreakMinutes(projectBreakSettings)
  );
}

export function clearBreakFromGross(grossMs) {
  return {
    break_deduction_ms: null,
    duration_ms: grossMs > 0 ? grossMs : null,
  };
}

export function preserveBreakOnGross(grossMs, existingBreakMs) {
  const breakMs = Math.min(existingBreakMs || 0, grossMs);
  return {
    break_deduction_ms: breakMs > 0 ? breakMs : null,
    duration_ms: grossMs > 0 ? grossMs - breakMs : null,
  };
}

function formatDurationLabel(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
}

export function formatBreakDeductionSubtext(grossMs, breakDeductionMs) {
  const minutes = Math.round((breakDeductionMs || 0) / 60000);
  if (minutes <= 0 || grossMs <= 0) return "";

  return `Van ${formatDurationLabel(grossMs)} totaal is ${minutes} min pauze afgetrokken`;
}
