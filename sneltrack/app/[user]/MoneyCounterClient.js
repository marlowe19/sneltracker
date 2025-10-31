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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startMs || stopMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs, stopMs]);

  if (!startMs || !hourlyRate) return null;

  // If stopped, use the stop time; otherwise use current time
  const currentTime = stopMs || now;
  const elapsed = currentTime - startMs;
  const hours = elapsed / (1000 * 60 * 60);
  const money = hours * hourlyRate;
  const formattedMoney = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money);

  return <span className="money-text">{formattedMoney}</span>;
}
