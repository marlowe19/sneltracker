"use client";

import { useState } from "react";

export default function WeeklyHoursClient() {
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(null);
  const [error, setError] = useState(null);

  async function handleFetchHours() {
    try {
      setLoading(true);
      setError(null);
      setHours(null);

      const res = await fetch("/my/api/calendar/capacity");
      
      if (!res.ok) {
        throw new Error("Kon beschikbare uren niet ophalen");
      }

      const data = await res.json();
      setHours(data.week1?.hours || 0);
    } catch (err) {
      console.error("Error fetching weekly hours:", err);
      setError(err.message || "Er is een fout opgetreden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Beschikbare uren
      </h3>
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleFetchHours}
          disabled={loading}
          className="w-full px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? "Ophalen..." : "Bekijk beschikbare uren deze week"}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        {hours !== null && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-blue-900">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold">
                Je hebt deze week {hours} uur beschikbaar
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

