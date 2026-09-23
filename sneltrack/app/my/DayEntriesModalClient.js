"use client";

import { useState, useEffect } from "react";
import DayEntriesListClient from "./components/DayEntriesListClient";

export default function DayEntriesModalClient({
  isOpen,
  onClose,
  dayDate,
  user,
}) {
  const [activeDayDate, setActiveDayDate] = useState(dayDate);

  useEffect(() => {
    if (isOpen) {
      setActiveDayDate(dayDate);
    }
  }, [isOpen, dayDate]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl shadow-2xl h-full flex flex-col transition-transform duration-300 ease-out translate-y-0 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <DayEntriesListClient
          selectedDate={activeDayDate}
          user={user}
          onClose={onClose}
          onDateChange={setActiveDayDate}
        />
      </div>
    </div>
  );
}
