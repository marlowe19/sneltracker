"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHM } from "@/lib/time";

export default function RunningClockClient({ startedAt, stoppedAt }) {
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
    if (!startMs || stopMs) return;
    // Initialize now when startMs becomes available to avoid timing issues
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs, stopMs]);

  const isRunning = startMs && !stopMs;
  const currentTime = stopMs || now;
  const elapsed = startMs ? Math.max(0, currentTime - startMs) : 0;
  const formatted = formatHM(elapsed);
  const [hours, minutes] = formatted.split(":");

  if (!startMs) {
    return (
      <span className="timer-text">
        <span>00</span>
        <span className="timer-colon">:</span>
        <span>00</span>
      </span>
    );
  }

  return (
    <span className="timer-text">
      <span>{hours}</span>
      <span className={`timer-colon ${isRunning ? "blink" : ""}`}>:</span>
      <span>{minutes}</span>
    </span>
  );
}
