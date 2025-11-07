"use client";

import { useState, useRef, useEffect } from "react";
import ProjectSelector from "@/app/components/ProjectSelector";

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

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      note_id: noteId,
      text: newItemText.trim(),
      checked: false,
      checked_by: null,
      created_by: user || "anonymous",
      position: items.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    setItems((prev) => [...prev, newItem]);
    setNewItemText("");

    // Simulate API call
    setTimeout(() => {
      // Focus input again for fast entry
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  }

  function handleToggleItem(itemId) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checked: !item.checked,
              checked_by: !item.checked ? user || "anonymous" : null,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );
  }

  function handleDeleteItem(itemId) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleContentChange(newContent) {
    setContent(newContent);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    // Debounced save would go here in Phase 2
  }

  function handleProjectChange(projectId) {
    setSelectedProjectId(projectId || "");
    setNote((prev) => ({ ...prev, project_id: projectId || null }));
    // API call to update project_id would go here in Phase 2
  }

  // Calculate checked count
  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;

  return (
    <div className="space-y-4">
      {/* Project Selector */}
      <ProjectSelector
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
        placeholder="Selecteer project (optioneel)"
        emptyPlaceholder="Geen project"
        user={user}
      />

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
          // Auto-save on blur would go here in Phase 2
          setIsSaving(true);
          setTimeout(() => setIsSaving(false), 500);
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
