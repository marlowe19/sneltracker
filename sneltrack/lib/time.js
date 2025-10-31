import {
  startOfWeek,
  endOfWeek,
  parseISO,
  differenceInMilliseconds,
  addMilliseconds,
} from "date-fns";

export function getWeekBounds(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function toIso(d) {
  return new Date(d).toISOString();
}

export function roundDurationTo15Minutes(ms) {
  const fifteen = 15 * 60 * 1000;
  return Math.round(ms / fifteen) * fifteen;
}

export function floorTo15Minutes(ms) {
  const fifteen = 15 * 60 * 1000;
  return Math.floor(ms / fifteen) * fifteen;
}

export function computeEntryDurationMs(startIso, endIso) {
  const start = parseISO(startIso);
  const end = endIso ? parseISO(endIso) : new Date();
  return Math.max(0, differenceInMilliseconds(end, start));
}

export function formatHMS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function daysBetween(start, end) {
  const days = [];
  const dayMs = 24 * 60 * 60 * 1000;
  let current = new Date(start);
  const endTime = new Date(end).getTime();
  while (current.getTime() <= endTime) {
    days.push(new Date(current));
    current = addMilliseconds(current, dayMs);
  }
  return days;
}
