"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ProjectSelector from "@/app/components/ProjectSelector";
import { supabase } from "@/lib/supabase";

export default function NoteClient({
  user,
  noteId,
  initialNote,
  initialItems = [],
}) {
  const [note, setNote] = useState(initialNote);
  const [items, setItems] = useState(initialItems);
  const [newItemText, setNewItemText] = useState("");
  const [content, setContent] = useState(
    initialNote.content || initialNote.list_notes || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialNote.project_id || ""
  );
  const [dueDate, setDueDate] = useState(
    initialNote.due_date
      ? new Date(initialNote.due_date).toISOString().split("T")[0]
      : ""
  );
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-resize textarea for content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Debounced content save
  const contentSaveTimeoutRef = useRef(null);
  const saveContent = useCallback(
    async (newContent) => {
      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current);
      }
      contentSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from("notes")
            .update({ content: newContent })
            .eq("id", noteId);
          if (error) throw error;
        } catch (error) {
          console.error("Error saving content:", error);
        }
      }, 1000); // 1 second debounce
    },
    [noteId]
  );

  // Real-time subscriptions
  useEffect(() => {
    // Subscribe to note changes
    const noteChannel = supabase
      .channel(`note:${noteId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `id=eq.${noteId}`,
        },
        (payload) => {
          console.log("📝 Note update received:", payload);
          setNote(payload.new);
          if (payload.new.content !== undefined) {
            setContent(payload.new.content || "");
          }
          if (payload.new.project_id !== undefined) {
            setSelectedProjectId(payload.new.project_id || "");
          }
          if (payload.new.due_date !== undefined) {
            setDueDate(
              payload.new.due_date
                ? new Date(payload.new.due_date).toISOString().split("T")[0]
                : ""
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Channel note:${noteId} status:`, status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Real-time subscription active for note");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Subscription error for note");
        }
      });

    // Subscribe to note_items changes
    const itemsChannel = supabase
      .channel(`note_items:${noteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "note_items",
          filter: `note_id=eq.${noteId}`,
        },
        (payload) => {
          console.log("📋 Note item change received:", payload);
          if (payload.eventType === "INSERT") {
            setItems((prev) => {
              // Check if item already exists (optimistic update)
              if (prev.find((item) => item.id === payload.new.id)) {
                return prev; // Already added optimistically, skip
              }
              // New items with position 0 go to top, others maintain order
              if (payload.new.position === 0) {
                return [payload.new, ...prev];
              }
              // For items with other positions, add at end (shouldn't happen for new items)
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) => {
              // Update the item in place, maintain order
              const updated = prev.map((item) =>
                item.id === payload.new.id ? payload.new : item
              );
              // Only re-sort if position actually changed and it's not a new item (position 0)
              const itemChanged = prev.find(
                (item) => item.id === payload.new.id
              );
              if (
                itemChanged &&
                itemChanged.position !== payload.new.position &&
                payload.new.position !== 0
              ) {
                // Position changed, re-sort (but keep position 0 items at top)
                return updated.sort((a, b) => {
                  if (a.position === 0 && b.position !== 0) return -1;
                  if (a.position !== 0 && b.position === 0) return 1;
                  if (a.position === 0 && b.position === 0) {
                    // Both are new items, sort by created_at DESC (newest first)
                    return new Date(b.created_at) - new Date(a.created_at);
                  }
                  return a.position - b.position;
                });
              }
              return updated;
            });
          } else if (payload.eventType === "DELETE") {
            setItems((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Channel note_items:${noteId} status:`, status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Real-time subscription active for note items");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Subscription error for note items");
        }
      });

    return () => {
      supabase.removeChannel(noteChannel);
      supabase.removeChannel(itemsChannel);
      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current);
      }
    };
  }, [noteId]);

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const text = newItemText.trim();
    setNewItemText("");

    // Optimistic update - add to top
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimisticItem = {
      id: tempId,
      note_id: noteId,
      text,
      checked: false,
      checked_by: null,
      created_by: user || "anonymous",
      position: 0, // New items go to top
      created_at: now,
      updated_at: now,
    };
    // Add to beginning of array
    setItems((prev) => [optimisticItem, ...prev]);

    try {
      const { data, error } = await supabase
        .from("note_items")
        .insert({
          note_id: noteId,
          text,
          checked: false,
          created_by: user || "anonymous",
          position: 0, // New items go to top
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic item with real item, keep at top
      setItems((prev) => {
        const filtered = prev.filter((item) => item.id !== tempId);
        // Add real item at the beginning
        return [data, ...filtered];
      });

      // Focus input again for fast entry
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error("Error adding item:", error);
      // Rollback optimistic update
      setItems((prev) => prev.filter((item) => item.id !== tempId));
      setNewItemText(text);
      alert("Kon item niet toevoegen");
    }
  }

  async function handleToggleItem(itemId) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newChecked = !item.checked;
    const newCheckedBy = newChecked ? user || "anonymous" : null;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, checked: newChecked, checked_by: newCheckedBy }
          : i
      )
    );

    try {
      const { error } = await supabase
        .from("note_items")
        .update({
          checked: newChecked,
          checked_by: newCheckedBy,
        })
        .eq("id", itemId);

      if (error) throw error;
    } catch (error) {
      console.error("Error toggling item:", error);
      // Rollback
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, checked: item.checked, checked_by: item.checked_by }
            : i
        )
      );
    }
  }

  async function handleDeleteItem(itemId) {
    // Optimistic update
    const item = items.find((i) => i.id === itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      const { error } = await supabase
        .from("note_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting item:", error);
      // Rollback
      if (item) {
        setItems((prev) =>
          [...prev, item].sort((a, b) => a.position - b.position)
        );
      }
      alert("Kon item niet verwijderen");
    }
  }

  function handleContentChange(newContent) {
    setContent(newContent);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    // Debounced save
    saveContent(newContent);
  }

  async function handleProjectChange(projectId) {
    const newProjectId = projectId || null;
    setSelectedProjectId(newProjectId || "");

    // Optimistic update
    setNote((prev) => ({ ...prev, project_id: newProjectId }));

    try {
      const { error } = await supabase
        .from("notes")
        .update({ project_id: newProjectId })
        .eq("id", noteId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating project:", error);
      // Rollback
      setSelectedProjectId(note.project_id || "");
      setNote((prev) => ({ ...prev, project_id: note.project_id }));
      alert("Kon project niet bijwerken");
    }
  }

  async function handleDueDateChange(newDate) {
    setDueDate(newDate);

    // Optimistic update
    setNote((prev) => ({ ...prev, due_date: newDate || null }));

    try {
      const { error } = await supabase
        .from("notes")
        .update({ due_date: newDate || null })
        .eq("id", noteId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating due date:", error);
      // Rollback
      setDueDate(
        note.due_date ? new Date(note.due_date).toISOString().split("T")[0] : ""
      );
      setNote((prev) => ({ ...prev, due_date: note.due_date }));
      alert("Kon datum niet bijwerken");
    }
  }

  // Calculate checked count
  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;

  return (
    <div className="space-y-4">
      {/* Project Selector and Due Date on one line */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={handleProjectChange}
            placeholder="Selecteer project (optioneel)"
            emptyPlaceholder="Geen project"
            user={user}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Datum
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
          />
        </div>
      </div>

      {/* Fast Entry Input for Items */}
      <form onSubmit={handleAddItem}>
        <input
          ref={inputRef}
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddItem(e);
            }
          }}
          placeholder="Voeg item toe (Enter om toe te voegen)..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
        />
      </form>

      {/* Content Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onBlur={() => {
          // Save immediately on blur
          if (content !== (note.content || "")) {
            setIsSaving(true);
            supabase
              .from("notes")
              .update({ content })
              .eq("id", noteId)
              .then(() => {
                setIsSaving(false);
              })
              .catch((error) => {
                console.error("Error saving content:", error);
                setIsSaving(false);
              });
          }
        }}
        placeholder="Notities..."
        rows={1}
        className="w-full px-4 py-3 border-0 rounded-lg focus:outline-none text-base resize-none overflow-hidden bg-transparent"
      />
      {isSaving && <div className="text-xs text-gray-500">Opslaan...</div>}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Geen items. Begin met typen om items toe te voegen.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleItem(item.id)}
                  className="w-5 h-5 rounded border-gray-300 text-[#008eff] focus:ring-[#008eff] cursor-pointer"
                />
                <span
                  className={`flex-1 text-base ${
                    item.checked
                      ? "line-through text-gray-500"
                      : "text-gray-900"
                  }`}
                >
                  {item.text}
                </span>
                {item.checked_by && (
                  <span className="text-xs text-gray-500">
                    door {item.checked_by}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
                  title="Verwijderen"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {/* Counter at bottom */}
          {totalCount > 0 && (
            <div className="text-center text-sm text-gray-600 pt-2 border-t border-gray-200 mt-2">
              {checkedCount} van {totalCount} voltooid
            </div>
          )}
        </>
      )}
    </div>
  );
}
