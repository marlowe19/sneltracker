// lib/format/format.ts
// Dutch number/date/duration formatting per MOBILE-SPEC.md "UX copy" section:
// € 1.234,50 · 3 juli 2026 · 6u 30m
import { format as formatDateFns } from "date-fns";
import { nl } from "date-fns/locale";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  // Intl already renders "€ 1.234,50" for nl-NL; normalize the narrow no-break
  // space Intl sometimes inserts after the symbol to a regular space.
  return currencyFormatter.format(safe).replace(/ /g, " ");
}

export function formatDateLong(date: Date | string | number): string {
  const d = new Date(date);
  return formatDateFns(d, "d MMMM yyyy", { locale: nl });
}

export function formatDateShort(date: Date | string | number): string {
  const d = new Date(date);
  return formatDateFns(d, "d MMM", { locale: nl });
}

export function formatWeekdayShort(date: Date | string | number): string {
  const d = new Date(date);
  return formatDateFns(d, "EEEEEE", { locale: nl });
}

/** e.g. "6u 30m", "45m", "0m" — matches lib/logic/utils/projectProgress.ts#formatHours */
export function formatDurationHoursMinutes(hours: number): string {
  if (!hours || hours === 0) return "0m";
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}u ${m}m` : `${h}u`;
}

/** Convert milliseconds to the same "6u 30m" format used across the app. */
export function formatMsAsHoursMinutes(ms: number): string {
  return formatDurationHoursMinutes(ms / (1000 * 60 * 60));
}
