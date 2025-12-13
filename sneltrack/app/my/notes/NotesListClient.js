"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/stores/useStore";
import { supabase } from "@/lib/supabase";

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

  // Real-time subscription for notes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notes:${user}${projectId ? `:${projectId}` : ""}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: projectId
            ? `created_by=eq.${user}&project_id=eq.${projectId}`
            : `created_by=eq.${user}`,
        },
        (payload) => {
          console.log("📝 Notes list change received:", payload);
          if (payload.eventType === "INSERT") {
            setNotes((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setNotes((prev) =>
              prev.map((note) =>
                note.id === payload.new.id ? payload.new : note
              )
            );
          } else if (payload.eventType === "DELETE") {
            setNotes((prev) =>
              prev.filter((note) => note.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        const channelName = `notes:${user}${projectId ? `:${projectId}` : ""}`;
        console.log(`📡 Channel ${channelName} status:`, status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Real-time subscription active for notes list");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Subscription error for notes list");
        } else if (status === "TIMED_OUT") {
          console.warn("⏱️ Subscription timed out for notes list");
        } else if (status === "CLOSED") {
          console.warn("🔒 Subscription closed for notes list");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, projectId]);

  async function handleCreateNote(e) {
    e.preventDefault();
    if (!newNoteName.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          name: newNoteName.trim(),
          project_id: projectId,
          created_by: user,
          due_date: new Date().toISOString().split("T")[0], // Default to today
        })
        .select()
        .single();

      if (error) throw error;

      setNewNoteName("");
      // Note will be added via real-time subscription
    } catch (error) {
      console.error("Error creating note:", error);
      alert("Kon notitie niet aanmaken");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteNote(noteId) {
    if (!confirm("Weet je zeker dat je deze notitie wilt verwijderen?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId)
        .eq("created_by", user); // Extra security check

      if (error) throw error;
      // Note will be removed via real-time subscription
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("Kon notitie niet verwijderen");
    }
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
                href={`/my/notes/${note.id}`}
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
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {note.due_date &&
                      (() => {
                        const dueDate = new Date(note.due_date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const dueDateOnly = new Date(dueDate);
                        dueDateOnly.setHours(0, 0, 0, 0);
                        const isOverdue = dueDateOnly < today;
                        const isToday =
                          dueDateOnly.getTime() === today.getTime();

                        return (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              isOverdue
                                ? "bg-red-100 text-red-700"
                                : isToday
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {dueDate.toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        );
                      })()}
                    <span className="text-xs text-gray-500">
                      {new Date(note.updated_at).toLocaleDateString("nl-NL")}
                    </span>
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
