"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/useStore";

export default function ProjectsHydrator({ user, initialProjects }) {
  const hydrateProjects = useStore((state) => state.hydrateProjects);

  // Hydrate projects from server on mount
  useEffect(() => {
    if (initialProjects) {
      hydrateProjects(initialProjects);
    }
  }, [initialProjects, hydrateProjects]);

  return null; // This component doesn't render anything
}
