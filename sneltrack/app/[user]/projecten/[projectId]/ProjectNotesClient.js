"use client";

import { useState } from "react";
import Link from "next/link";
import NotesListClient from "../../notes/NotesListClient";

export default function ProjectNotesClient({ user, projectId, isShared }) {
  // Mock data filtered by project_id - will be replaced with Supabase queries in Phase 2
  const [notes] = useState([
    {
      id: "proj-1",
      name: "Project Notities",
      project_id: projectId,
      created_by: user,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-2",
      name: "Todo Lijst",
      project_id: projectId,
      created_by: user,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  return (
    <div className="space-y-4">
      <NotesListClient user={user} initialNotes={notes} projectId={projectId} />
    </div>
  );
}

