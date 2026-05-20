"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/useStore";
import TimerSectionClient from "./TimerSectionClient";

export default function TimerSectionWrapperClient({
  user,
  activeEntries,
  stoppedTimers,
}) {
  const hydrateActiveEntries = useStore((state) => state.hydrateActiveEntries);
  const hydrateStoppedTimers = useStore((state) => state.hydrateStoppedTimers);
  const addPendingTimer = useStore((state) => state.addPendingTimer);

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
      <section className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative">
        <div className="pt-4 pb-[calc(3.5rem+20px)] relative z-10">
          <TimerSectionClient user={user} />
        </div>
      </section>
      <div
        className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 py-[22px] sm:max-w-xl md:max-w-2xl"
        style={{
          bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 10px)",
        }}
      >
        <button
          type="button"
          onClick={handleAddTimer}
          className="btn px-4 text-base rounded-lg w-full flex items-center gap-2 min-h-[24px]"
          aria-label="Timer toevoegen"
        >
          <span>Timer toevoegen</span>
        </button>
      </div>
    </>
  );
}
