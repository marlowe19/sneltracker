"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/useStore";
import HeaderSectionClient from "./HeaderSectionClient";
import TimerSectionClient from "./TimerSectionClient";

export default function TimerSectionWrapperClient({
  user,
  activeEntries,
  stoppedTimers,
}) {
  const hydrateActiveEntries = useStore((state) => state.hydrateActiveEntries);
  const hydrateStoppedTimers = useStore((state) => state.hydrateStoppedTimers);
  const addPendingTimer = useStore((state) => state.addPendingTimer);

  // Hydrate active entries and stopped timers from server on mount
  useEffect(() => {
    hydrateActiveEntries(activeEntries);
    hydrateStoppedTimers(stoppedTimers || []);
  }, [
    activeEntries,
    stoppedTimers,
    hydrateActiveEntries,
    hydrateStoppedTimers,
  ]);

  function handleAddTimer() {
    const newTimer = {
      id: `pending-${Date.now()}-${Math.random()}`,
      projectId: null,
    };
    addPendingTimer(newTimer);
  }

  return (
    <>
      <HeaderSectionClient user={user} onAddTimer={handleAddTimer} />
      <section className="bg-gray-100 flex-1 min-h-0 overflow-y-auto">
        <div className="pt-4">
          <TimerSectionClient user={user} />
        </div>
      </section>
    </>
  );
}
