"use client";

import { useState, useEffect, useRef } from "react";

export default function ProjectForecastClient({ user, projectId, project }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function fetchForecast() {
    // Prevent concurrent calls
    if (loading) return;

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setForecast(null);

    try {
      const url = `/${encodeURIComponent(
        user
      )}/projecten/${projectId}/api/forecast`;
      const response = await fetch(url, {
        method: "POST",
        signal: abortControllerRef.current.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.message || data.error || "Voorspelling berekenen mislukt"
        );
      }

      const data = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setForecast(data);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err.name === "AbortError") {
        return;
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(err.message || "Voorspelling berekenen mislukt");
        setForecast(null);
      }
    } finally {
      // Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  // Format hours
  function formatHours(totalHours) {
    if (!totalHours && totalHours !== 0) return "0h";
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (hours === 0) {
      return `${minutes}m`;
    }
    return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
  }

  // Format date
  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("nl-NL", {
      month: "long",
      day: "numeric",
    });
  }

  // Forecast display component (reusable)
  function ForecastDisplay({
    forecast,
    title,
    icon,
    iconColor,
    showBorder = true,
  }) {
    if (!forecast) return null;

    return (
      <div
        className={`space-y-3 ${
          showBorder ? "pb-4 border-b border-gray-200" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold text-gray-900">
            {formatDate(forecast.forecastDate)}
          </div>
          {forecast.daysEarly > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              {forecast.daysEarly} {forecast.daysEarly === 1 ? "dag" : "dagen"}{" "}
              te vroeg
            </span>
          )}
          {forecast.daysLate > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              {forecast.daysLate} {forecast.daysLate === 1 ? "dag" : "dagen"} te
              laat
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{forecast.explanation}</p>
      </div>
    );
  }

  // Get project status
  function getProjectStatus() {
    if (!project) return "Onbekend";
    if (project.status) {
      const statusMap = {
        active: "Actief",
        planned: "Gepland",
        on_hold: "On Hold",
        completed: "Voltooid",
        cancelled: "Geannuleerd",
      };
      return statusMap[project.status] || project.status;
    }
    return "Actief";
  }

  // Get hours logged
  const hoursLogged = forecast?.hoursSpent || 0;

  // Get due date
  const dueDate = project?.due_date || project?.end_date;

  if (!forecast && !loading && !error) {
    return (
      <div className="mt-6">
        <button
          onClick={fetchForecast}
          disabled={loading}
          className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Bereken Voorspelling
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Project Info Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          {project?.name || "Project"}
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{getProjectStatus()}</span>
          <span>•</span>
          <span>{formatHours(hoursLogged)} geregistreerd</span>
          {dueDate && (
            <>
              <span>•</span>
              <span>Deadline {formatDate(dueDate)}</span>
            </>
          )}
        </div>
      </div>

      {/* Forecast Button */}
      {!forecast && !loading && (
        <button
          onClick={fetchForecast}
          disabled={loading}
          className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Bereken Voorspelling
        </button>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
          <span className="ml-3 text-gray-600">Voorspelling berekenen...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchForecast}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {/* Forecast Result */}
      {forecast && !loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          {/* Calendar-based Forecast */}
          <ForecastDisplay
            forecast={forecast.calendarForecast}
            title="Voorspelling op basis van agenda"
            icon={
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
            showBorder={
              forecast.historicalForecast || forecast.capacityForecast
            }
          />

          {/* Historical-based Forecast */}
          <ForecastDisplay
            forecast={forecast.historicalForecast}
            title="Voorspelling op basis van historie"
            icon={
              <svg
                className="w-5 h-5 text-gray-600"
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
            }
            showBorder={forecast.capacityForecast}
          />

          {/* Capacity-based Forecast */}
          <ForecastDisplay
            forecast={forecast.capacityForecast}
            title="Voorspelling op basis van capaciteit"
            icon={
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
            showBorder={false}
          />

          {/* Show message if no forecasts available */}
          {!forecast.calendarForecast &&
            !forecast.historicalForecast &&
            !forecast.capacityForecast && (
              <p className="text-sm text-gray-600">{forecast.explanation}</p>
            )}

          {/* Refresh Button */}
          <button
            onClick={fetchForecast}
            disabled={loading}
            className="text-sm text-[#008eff] hover:text-[#0073cc] underline"
          >
            Herbereken
          </button>
        </div>
      )}
    </div>
  );
}
