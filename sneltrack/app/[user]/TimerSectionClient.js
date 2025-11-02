"use client";

import { useState, useEffect } from "react";
import RunningClockClient from "./RunningClockClient";
import MoneyCounterClient from "./MoneyCounterClient";
import StartStopButtonsClient from "./StartStopButtonsClient";

export default function TimerSectionClient({ user, active }) {
  const [stoppedAt, setStoppedAt] = useState(null);
  const [projectName, setProjectName] = useState(null);

  // Reset stoppedAt when active entry changes (new entry started or current one cleared)
  useEffect(() => {
    setStoppedAt(null);
  }, [active?.start_time]);

  // Fetch project name if active.project is an ID
  useEffect(() => {
    async function loadProjectName() {
      if (!active?.project) {
        setProjectName(null);
        return;
      }

      // Try to fetch project by ID (assuming project is stored as ID now)
      // If it fails or returns null, it might be a legacy name string
      try {
        const res = await fetch(`/${encodeURIComponent(user)}/projecten/api`);
        const data = await res.json();
        const project = data.projects?.find((p) => p.id === active.project);
        if (project) {
          setProjectName(project.name);
        } else {
          // Fallback to displaying what's stored (for legacy entries with project names)
          setProjectName(active.project);
        }
      } catch (error) {
        // On error, just display what's stored
        setProjectName(active.project);
      }
    }

    loadProjectName();
  }, [active?.project, user]);

  function handleStopClick(stopTime) {
    setStoppedAt(stopTime);
  }

  return (
    <>
      <div className="timer-box flex flex-col justify-center items-center py-6">
        {active && projectName && (
          <div className="px-4 pb-2">
            <div className="text-center text-sm text-gray-700">
              <div className="text-xs text-gray-600 mt-1">{projectName}</div>
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
      <StartStopButtonsClient
        user={user}
        active={active}
        onStopClick={handleStopClick}
      />
    </>
  );
}
