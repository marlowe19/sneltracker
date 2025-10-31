"use client";

import { useEffect, useMemo, useState } from "react";

export default function MoneyCounterClient({ startedAt, hourlyRate }) {
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

  if (!startMs || !hourlyRate) return null;

  const elapsed = now - startMs;
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
