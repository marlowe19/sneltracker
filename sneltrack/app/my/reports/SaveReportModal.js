"use client";

import { useState } from "react";

export default function SaveReportModal({ isOpen, onClose, onSave, loading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), description.trim() || null);
      setName("");
      setDescription("");
    }
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Rapport opslaan
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="report-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Naam <span className="text-red-500">*</span>
            </label>
            <input
              id="report-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Bijv. Q1 2024 Rapport"
              required
              disabled={loading}
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="report-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Beschrijving (optioneel)
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optionele beschrijving van dit rapport"
              rows={3}
              disabled={loading}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !name.trim()}
            >
              {loading ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

