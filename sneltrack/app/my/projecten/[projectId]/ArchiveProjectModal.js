"use client";

import { useState } from "react";

export default function ArchiveProjectModal({
  isOpen,
  onClose,
  onArchive,
  projectName,
  isArchiving,
}) {
  const [actualEndDate, setActualEndDate] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onArchive({
      actual_end_date: actualEndDate || null,
      description: description.trim() || null,
    });
  };

  const handleCancel = () => {
    setActualEndDate("");
    setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Project Archiveren
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Archiveer "{projectName}". Je kunt optioneel de werkelijke einddatum
          en een beschrijving toevoegen.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="actualEndDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Werkelijke einddatum (optioneel)
              </label>
              <input
                type="date"
                id="actualEndDate"
                value={actualEndDate}
                onChange={(e) => setActualEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base"
                disabled={isArchiving}
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Beschrijving - Hoe ging het project? (optioneel)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-base resize-none"
                placeholder="Beschrijf hoe het project is verlopen..."
                disabled={isArchiving}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isArchiving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isArchiving}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isArchiving ? "Archiveren..." : "Archiveren"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
