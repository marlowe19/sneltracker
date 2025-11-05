"use client";

import { useState } from "react";
import HeaderSectionClient from "./HeaderSectionClient";
import TimerSectionClient from "./TimerSectionClient";

export default function TimerSectionWrapperClient({ user, activeEntries }) {
  const [pendingTimers, setPendingTimers] = useState([]);
  const [nextPendingId, setNextPendingId] = useState(1);

  function handleAddTimer() {
    const newTimer = {
      id: `pending-${nextPendingId}`,
      projectId: null,
    };
    setPendingTimers((prev) => [...prev, newTimer]);
    setNextPendingId((prev) => prev + 1);
  }

  return (
    <>
      <HeaderSectionClient user={user} onAddTimer={handleAddTimer} />
      <section className="bg-gray-100 flex-1 min-h-0 overflow-y-auto">
        <div className="pt-4">
          <TimerSectionClient
            user={user}
            activeEntries={activeEntries}
            pendingTimers={pendingTimers}
            setPendingTimers={setPendingTimers}
          />
        </div>
      </section>
    </>
  );
}
