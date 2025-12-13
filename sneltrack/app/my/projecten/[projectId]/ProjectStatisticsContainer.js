"use client";

import ProjectStatisticsClient from "./ProjectStatisticsClient";

export function ProjectStatistics({ user, projectId, project }) {
  return (
    <ProjectStatisticsClient
      user={user}
      projectId={projectId}
      project={project}
    />
  );
}
