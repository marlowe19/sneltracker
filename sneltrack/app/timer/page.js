"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TimerSectionWrapperClient from "../my/TimerSectionWrapperClient";
import {
  startLocalTimer,
  stopLocalTimer,
  getRunningEntry,
} from "@/lib/localStorage/localTimerService";

export default function TimerPage() {
  const [user, setUser] = useState("marlowe");
  const [activeEntries, setActiveEntries] = useState([]);
  const [stoppedTimers, setStoppedTimers] = useState([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  const getLocalEntriesFromLocalStorage = () => {
    const localEntries = localStorage.getItem("localEntries");
    return localEntries ? JSON.parse(localEntries) : [];
  };

  useEffect(() => {
    const localEntries = getLocalEntriesFromLocalStorage();
    const runningEntries = localEntries.filter((entry) => entry.isRunning);
  }, []);

  // Handle URL action parameters for starting/stopping local timers
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "start") {
      startLocalTimer();
      // Remove the action parameter from URL
      router.replace("/timer");
    } else if (action === "stop") {
      const running = getRunningEntry();
      if (running) {
        stopLocalTimer(running.id);
      }
      // Remove the action parameter from URL
      router.replace("/timer");
    }
  }, [searchParams, router]);

  return (
    <div>
      <h1>Timer</h1>
      <TimerSectionWrapperClient
        user={user}
        activeEntries={activeEntries}
        stoppedTimers={[]}
      />
    </div>
  );
}
