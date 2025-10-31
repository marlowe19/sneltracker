"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHMS } from "@/lib/time";

export default function RunningClockClient({ startedAt, stoppedAt }) {
  const startMs = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : null),
    [startedAt]
  );
  const stopMs = useMemo(
    () => (stoppedAt ? new Date(stoppedAt).getTime() : null),
    [stoppedAt]
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startMs || stopMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs, stopMs]);

  if (!startMs) return <span>00:00:00</span>;

  // If stopped, use the stop time; otherwise use current time
  const currentTime = stopMs || now;
  const elapsed = currentTime - startMs;
  return <span className="timer-text">{formatHMS(elapsed)}</span>;
}
