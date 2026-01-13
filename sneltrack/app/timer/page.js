"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TimerSectionWrapperClient from "../my/TimerSectionWrapperClient";
import {
  startLocalTimer,
  stopLocalTimer,
  getRunningEntry,
} from "@/lib/localStorage/localTimerService";

function TimerActionHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

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

  return null;
}

export default function TimerPage() {
  const [user, setUser] = useState("marlowe");
  const [activeEntries, setActiveEntries] = useState([]);
  const [stoppedTimers, setStoppedTimers] = useState([]);

  const getLocalEntriesFromLocalStorage = () => {
    const localEntries = localStorage.getItem("localEntries");
    return localEntries ? JSON.parse(localEntries) : [];
  };

  useEffect(() => {
    const localEntries = getLocalEntriesFromLocalStorage();
    const runningEntries = localEntries.filter((entry) => entry.isRunning);
  }, []);

  return (
    <div>
      <Suspense fallback={null}>
        <TimerActionHandler />
      </Suspense>
      <h1>Timer</h1>
      <TimerSectionWrapperClient
        user={user}
        activeEntries={activeEntries}
        stoppedTimers={[]}
      />
    </div>
  );
}
