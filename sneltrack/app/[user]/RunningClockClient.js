"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHMS } from "@/lib/time";

export default function RunningClockClient({ startedAt }) {
  const startMs = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : null),
    [startedAt]
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  if (!startMs) return <span>00:00:00</span>;
  const elapsed = now - startMs;
  return <span className="timer-text">{formatHMS(elapsed)}</span>;
}
