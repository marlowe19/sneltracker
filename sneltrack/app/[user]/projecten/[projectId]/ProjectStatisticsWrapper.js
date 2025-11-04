"use client";

import { useState } from "react";
import DateRangeSelectorClient from "./DateRangeSelectorClient";
import ProjectStatisticsClient from "./ProjectStatisticsClient";

export function useDateRange() {
  // Default to current week
  const [rangeType, setRangeType] = useState("week");
  const [referenceDate, setReferenceDate] = useState(new Date());

  const handleRangeChange = (newRangeType, newReferenceDate) => {
    setRangeType(newRangeType);
    setReferenceDate(newReferenceDate);
  };

  return {
    rangeType,
    referenceDate,
    handleRangeChange,
  };
}

export function DateRangeSelector({ rangeType, referenceDate, onRangeChange }) {
  return (
    <div className="mb-4">
      <DateRangeSelectorClient
        rangeType={rangeType}
        referenceDate={referenceDate}
        onRangeChange={onRangeChange}
      />
    </div>
  );
}

export function ProjectStatistics({
  user,
  projectId,
  project,
  rangeType,
  referenceDate,
}) {
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

// Wrapper component that manages state and renders both
export default function ProjectStatisticsWrapper({ user, projectId, project }) {
  const { rangeType, referenceDate, handleRangeChange } = useDateRange();

  return (
    <>
      <DateRangeSelector
        rangeType={rangeType}
        referenceDate={referenceDate}
        onRangeChange={handleRangeChange}
      />
      <ProjectStatistics
        user={user}
        projectId={projectId}
        project={project}
        rangeType={rangeType}
        referenceDate={referenceDate}
      />
    </>
  );
}
