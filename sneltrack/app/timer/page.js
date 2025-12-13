"use client";
import { useEffect, useState } from "react";
import TimerSectionWrapperClient from "../my/TimerSectionWrapperClient";

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
      <h1>Timer</h1>
      <TimerSectionWrapperClient
        user={user}
        activeEntries={activeEntries}
        stoppedTimers={[]}
      />
    </div>
  );
}
