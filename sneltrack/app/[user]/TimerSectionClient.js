"use client";

import { useState, useEffect } from "react";
import RunningClockClient from "./RunningClockClient";
import MoneyCounterClient from "./MoneyCounterClient";
import StartStopButtonsClient from "./StartStopButtonsClient";

export default function TimerSectionClient({ user, active }) {
  const [stoppedAt, setStoppedAt] = useState(null);

  // Reset stoppedAt when active entry changes (new entry started or current one cleared)
  useEffect(() => {
    setStoppedAt(null);
  }, [active?.start_time]);

  function handleStopClick(stopTime) {
    setStoppedAt(stopTime);
  }

  return (
    <>
      <div className="timer-box flex flex-col justify-center items-center py-6">
        {active && (
          <div className="px-4 pb-2">
            <div className="text-center text-sm text-gray-700">
              {active.project && (
                <div className="text-xs text-gray-600 mt-1">
                  {active.project}
                </div>
              )}
            </div>
          </div>
        )}
        <RunningClockClient
          startedAt={active?.start_time || null}
          stoppedAt={stoppedAt}
        />
        {active?.hourly_rate && (
          <div className="mt-2 text-lg font-semibold text-gray-700">
            <MoneyCounterClient
              startedAt={active.start_time}
              hourlyRate={active.hourly_rate}
              stoppedAt={stoppedAt}
            />
          </div>
        )}
      </div>
      <StartStopButtonsClient user={user} onStopClick={handleStopClick} />
    </>
  );
}
