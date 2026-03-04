"use client";

import { ChevronLeft } from "@carbon/icons-react";

export default function FullScreenModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col h-dvh bg-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#008eff] transition"
          aria-label="Terug"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#008eff] transition text-gray-600 hover:text-gray-900"
          aria-label="Sluiten"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      {/* Content - scrollable */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}
