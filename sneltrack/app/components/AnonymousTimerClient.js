"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import RunningClockClient from "../my/RunningClockClient";
import MoneyCounterClient from "../my/MoneyCounterClient";
import { formatHM } from "@/lib/time";

const DEFAULT_HOURLY_RATE = 30;
import {
  getRunningEntry,
  getStoppedEntries,
  startLocalTimer,
  stopLocalTimer,
  getLocalEntryCount,
  deleteLocalEntry,
} from "@/lib/localStorage/localTimerService";

// Custom hook to subscribe to localStorage data
function useLocalTimerData() {
  // Subscribe to changes (localStorage doesn't have events, so we just re-render on user actions)
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") {
      return JSON.stringify({ running: null, stopped: [], count: 0 });
    }
    return JSON.stringify({
      running: getRunningEntry(),
      stopped: getStoppedEntries().slice(0, 5),
      count: getLocalEntryCount(),
    });
  }, []);

  const getServerSnapshot = useCallback(() => {
    return JSON.stringify({ running: null, stopped: [], count: 0 });
  }, []);

  const subscribe = useCallback((callback) => {
    // Listen for storage events from other tabs
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  }, []);

  const dataStr = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return JSON.parse(dataStr);
}

export default function AnonymousTimerClient() {
  const {
    running: runningEntry,
    stopped: stoppedEntries,
    count: entryCount,
  } = useLocalTimerData();
  const [, forceUpdate] = useState(0);

  // Force re-render after local storage operations
  const refreshData = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  function handleStart() {
    startLocalTimer();
    refreshData();
  }

  function handleStop() {
    if (runningEntry) {
      stopLocalTimer(runningEntry.id);
      refreshData();
    }
  }

  function handleDelete(id) {
    deleteLocalEntry(id);
    refreshData();
  }

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Login prompt */}
      <div className="mb-6 text-center">
        <p className="text-gray-600 mb-3">
          {entryCount > 0
            ? `${entryCount} ${
                entryCount === 1 ? "tijdregistratie" : "tijdregistraties"
              } lokaal opgeslagen`
            : "Start een timer om je tijd bij te houden"}
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0070cc] transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Inloggen om op te slaan
        </Link>
      </div>

      {/* Active Timer */}
      {runningEntry ? (
        <div className="timer-box flex flex-row items-center pl-4 pr-4 pt-2 pb-2 rounded-lg mb-4 bg-white border border-snelgray">
          {/* Left column: Project name (static) and counter */}
          <div className="flex flex-col flex-1">
            <div className="py-2 text-base text-gray-700">Kies een project</div>
            <div className="flex flex-col items-start">
              <div className="text-3xl font-semibold">
                <RunningClockClient
                  startedAt={runningEntry.start_time}
                  stoppedAt={null}
                />
              </div>
              <div className="mt-1 text-base font-semibold text-gray-700">
                <MoneyCounterClient
                  startedAt={runningEntry.start_time}
                  hourlyRate={DEFAULT_HOURLY_RATE}
                  stoppedAt={null}
                />
              </div>
            </div>
          </div>

          {/* Right column: Stop button */}
          <div className="flex items-center justify-center shrink-0 pl-4 self-center">
            <button
              type="button"
              onClick={handleStop}
              className="w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 flex items-center justify-center transition-colors shrink-0"
              aria-label="Stop timer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-white"
              >
                <rect
                  x="7"
                  y="7"
                  width="10"
                  height="10"
                  rx="2"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* Start new timer button */
        <div className="timer-box flex flex-row items-center pl-4 pr-4 pt-2 pb-2 rounded-lg mb-4 bg-white border border-snelgray">
          {/* Left column: Project name (static) and counter */}
          <div className="flex flex-col flex-1">
            <div className="py-2 text-base text-gray-700">Geen project</div>
            <div className="flex flex-col items-start">
              <div className="text-3xl font-semibold">
                <span className="timer-text">
                  <span>00</span>
                  <span className="timer-colon">:</span>
                  <span>00</span>
                  <span className="timer-colon">:</span>
                  <span>00</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right column: Play button */}
          <div className="flex items-center justify-center shrink-0 pl-4 self-center">
            <button
              type="button"
              onClick={handleStart}
              className="w-12 h-12 rounded-full bg-[#E5F5F4] hover:bg-green-600 active:bg-green-700 flex items-center justify-center transition-colors shrink-0 group"
              aria-label="Start timer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-[#40A69F] group-hover:text-white group-active:text-white transition-colors"
              >
                <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Stopped entries list */}
      {stoppedEntries.length > 0 && (
        <>
          <div className="my-6 border-t border-gray-200"></div>
          <div className="text-sm font-medium text-gray-500 mb-3">
            Recente timers
          </div>
          {stoppedEntries.map((entry) => {
            const durationMs = entry.duration_ms || 0;
            const formattedDuration = formatHM(durationMs);
            const [hours, minutes] = formattedDuration.split(":");
            const totalMoney =
              durationMs > 0
                ? (durationMs / (1000 * 60 * 60)) * DEFAULT_HOURLY_RATE
                : 0;

            return (
              <div
                key={entry.id}
                className="timer-box flex flex-row items-center pl-4 pr-4 pt-2 pb-2 rounded-lg mb-4 bg-white border border-snelgray opacity-75"
              >
                {/* Left column: Project name and time */}
                <div className="flex flex-col flex-1">
                  <div className="py-2 text-base text-gray-700">
                    Geen project
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-3xl font-semibold">
                      <span className="timer-text">
                        <span>{hours}</span>
                        <span className="timer-colon">:</span>
                        <span>{minutes}</span>
                      </span>
                    </div>
                    {totalMoney > 0 && (
                      <div className="mt-1 text-base font-semibold text-gray-700">
                        €{totalMoney.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right column: Delete button */}
                <div className="flex items-center justify-center shrink-0 pl-4 self-center">
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-red-100 active:bg-red-200 flex items-center justify-center transition-colors shrink-0 group"
                    aria-label="Verwijderen"
                    title="Verwijderen"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400 group-hover:text-red-500 transition-colors"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
