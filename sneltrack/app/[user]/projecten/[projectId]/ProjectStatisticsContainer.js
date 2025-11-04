"use client";

import { useState, createContext, useContext } from "react";
import DateRangeSelectorClient from "./DateRangeSelectorClient";
import ProjectStatisticsClient from "./ProjectStatisticsClient";

const DateRangeContext = createContext();

export function DateRangeProvider({ children }) {
  // Default to current week
  const [rangeType, setRangeType] = useState("week");
  const [referenceDate, setReferenceDate] = useState(new Date());

  const handleRangeChange = (newRangeType, newReferenceDate) => {
    setRangeType(newRangeType);
    setReferenceDate(newReferenceDate);
  };

  return (
    <DateRangeContext.Provider
      value={{ rangeType, referenceDate, handleRangeChange }}
    >
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRangeContext() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDateRangeContext must be used within DateRangeProvider");
  }
  return context;
}

export function DateRangeSelector() {
  const { rangeType, referenceDate, handleRangeChange } = useDateRangeContext();
  return (
    <DateRangeSelectorClient
      rangeType={rangeType}
      referenceDate={referenceDate}
      onRangeChange={handleRangeChange}
    />
  );
}

export function ProjectStatistics({ user, projectId, project }) {
  const { rangeType, referenceDate } = useDateRangeContext();
  return (
    <ProjectStatisticsClient
      user={user}
      projectId={projectId}
      project={project}
      rangeType={rangeType}
      referenceDate={referenceDate}
    />
  );
}

export default function ProjectStatisticsContainer({ user, projectId, project, children }) {
  return (
    <DateRangeProvider>
      {children}
      <ProjectStatistics user={user} projectId={projectId} project={project} />
    </DateRangeProvider>
  );
}

