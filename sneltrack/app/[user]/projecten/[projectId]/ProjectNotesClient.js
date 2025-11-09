"use client";

import { useState, useEffect } from "react";
import NotesListClient from "../../notes/NotesListClient";

export default function ProjectNotesClient({ user, projectId, isShared }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchNotes() {
      if (!user || !projectId) return;

      setLoading(true);
      setError(null);

      try {
        const url = new URL(
          `/${encodeURIComponent(user)}/notes/api`,
          window.location.origin
        );
        url.searchParams.set("projectId", projectId);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch notes: ${res.status}`);
        }

        const data = await res.json();
        setNotes(data.notes || []);
      } catch (err) {
        console.error("Error fetching project notes:", err);
        setError(err.message || "Kon notities niet ophalen");
        setNotes([]);
      } finally {
        setLoading(false);
      }
    }

    fetchNotes();
  }, [user, projectId]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">Notities laden...</div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Fout: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <NotesListClient user={user} initialNotes={notes} projectId={projectId} />
    </div>
  );
}
