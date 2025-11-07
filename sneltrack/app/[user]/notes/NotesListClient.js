"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/stores/useStore";

export default function NotesListClient({
  user,
  initialNotes = [],
  projectId = null,
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [newNoteName, setNewNoteName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const projects = useStore((state) => state.projects);
  const fetchProjects = useStore((state) => state.fetchProjects);

  // Fetch projects if not loaded
  useEffect(() => {
    if (projects.length === 0 && user) {
      fetchProjects(user);
    }
  }, [projects.length, user, fetchProjects]);

  async function handleCreateNote(e) {
    e.preventDefault();
    if (!newNoteName.trim()) return;

    setIsCreating(true);
    // Simulate API call
    setTimeout(() => {
      const newNote = {
        id: Date.now().toString(),
        name: newNoteName.trim(),
        project_id: projectId,
        created_by: user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setNotes((prev) => [newNote, ...prev]);
      setNewNoteName("");
      setIsCreating(false);
    }, 200);
  }

  function handleDeleteNote(noteId) {
    if (!confirm("Weet je zeker dat je deze notitie wilt verwijderen?")) {
      return;
    }
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  }

  return (
    <div className="space-y-4">
      {/* Create New Note */}
      <form onSubmit={handleCreateNote} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNoteName}
            onChange={(e) => setNewNoteName(e.target.value)}
            placeholder="Nieuwe notitie..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
            autoFocus
          />
          <button
            type="submit"
            disabled={isCreating || !newNoteName.trim()}
            className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 text-sm"
          >
            {isCreating ? "..." : "Toevoegen"}
          </button>
        </div>
      </form>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Geen notities gevonden
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Link
                href={`/${encodeURIComponent(user)}/notes/${note.id}`}
                className="flex-1 flex items-center gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {note.name}
                    </span>
                    {note.project_id &&
                      (() => {
                        const project = projects.find(
                          (p) => p.id === note.project_id
                        );
                        return project ? (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {project.name}
                          </span>
                        ) : null;
                      })()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(note.updated_at).toLocaleDateString("nl-NL")}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleDeleteNote(note.id)}
                className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
                title="Verwijderen"
              >
                Verwijderen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
