"use client";

import { useEffect, useMemo, useState } from "react";

export default function MoneyCounterClient({
  startedAt,
  hourlyRate,
  stoppedAt,
}) {
  const startMs = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : null),
    [startedAt]
  );
  const stopMs = useMemo(
    () => (stoppedAt ? new Date(stoppedAt).getTime() : null),
    [stoppedAt]
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startMs) return;
    // Update every minute (60000ms) to match the timer's display cadence
    // The timer displays in minute intervals, so money should update the same way
    const id = setInterval(() => {
      if (!stopMs) {
        // Only update if timer is still running
        setNow(Date.now());
      }
    }, 60000); // Update every minute instead of every second
    return () => clearInterval(id);
  }, [startMs, stopMs]);

  if (!startMs || !hourlyRate) return null;

  // If stopped, use the stop time; otherwise use current time
  const currentTime = stopMs || now;
  const elapsed = currentTime - startMs;

  // Round elapsed time to nearest minute (matching formatHM behavior)
  // This ensures the money counter updates at the same cadence as the timer display
  const elapsedMinutes = Math.floor(elapsed / 60000);
  const elapsedMs = elapsedMinutes * 60000;

  const hours = elapsedMs / (1000 * 60 * 60);
  const money = hours * hourlyRate;
  const formattedMoney = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money);

  return <span className="money-text">{formattedMoney}</span>;
}
