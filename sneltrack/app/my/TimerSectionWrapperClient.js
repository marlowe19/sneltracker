"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/stores/useStore";
import HeaderSectionClient from "./HeaderSectionClient";
import TimerSectionClient from "./TimerSectionClient";
import { getTodaysQuote } from "@/lib/quotes";

export default function TimerSectionWrapperClient({
  user,
  activeEntries,
  stoppedTimers,
}) {
  const hydrateActiveEntries = useStore((state) => state.hydrateActiveEntries);
  const hydrateStoppedTimers = useStore((state) => state.hydrateStoppedTimers);
  const addPendingTimer = useStore((state) => state.addPendingTimer);

  // Calculate quote only on client side to avoid hydration mismatch
  const [todaysQuote] = useState(() => {
    // Only calculate on client side
    if (typeof window !== "undefined") {
      return getTodaysQuote();
    }
    return null;
  });

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
      {/* <HeaderSectionClient user={user} onAddTimer={handleAddTimer} /> */}
      <section className="flex-1 min-h-0 border-t border-gray-200 overflow-y-auto overscroll-contain relative flex flex-col justify-between">
        {/* {todaysQuote && (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none flex items-end justify-center pb-4">
            <div className="text-center px-4 max-w-md mx-auto">
              <p className="text-gray-700 text-sm italic mb-1">
                &ldquo;{todaysQuote.quote}&rdquo;
              </p>
              <p className="text-gray-600 text-xs">— {todaysQuote.author}</p>
            </div>
          </div>
        )} */}
        <div className="pt-4 relative z-10">
          <TimerSectionClient user={user} />
        </div>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={handleAddTimer}
            className="btn px-4 text-base rounded-lg w-full flex items-center gap-2 min-h-[24px] "
            aria-label="Timer toevoegen"
          >
            <span>Timer toevoegen</span>
          </button>
        </div>
      </section>
    </>
  );
}
