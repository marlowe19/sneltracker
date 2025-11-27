"use client";

import { useState, useEffect, useRef } from "react";

export default function ProjectForecastClient({ user, projectId, project }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Expenses summary + run period cards state
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expensesError, setExpensesError] = useState(null);

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

  // Fetch expenses summary once on mount
  useEffect(() => {
    async function fetchExpensesSummary() {
      try {
        setLoadingExpenses(true);
        setExpensesError(null);
        const url = `/${encodeURIComponent(
          user
        )}/projecten/${projectId}/api?action=expensesSummary`;
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to fetch expenses summary (${res.status})`
          );
        }
        const data = await res.json();
        setExpenseSummary(data);
      } catch (err) {
        console.error("Error fetching expenses summary:", err);
        setExpensesError(err.message || "Failed to fetch expenses summary");
      } finally {
        setLoadingExpenses(false);
      }
    }

    if (projectId && user) {
      fetchExpensesSummary();
    }
  }, [projectId, user]);

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

  // Format money (EUR)
  function formatMoney(amount) {
    if (!amount && amount !== 0) return "";
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  // Format date for headings (e.g. "2 januari")
  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("nl-NL", {
      month: "long",
      day: "numeric",
    });
  }

  // Format YYYY-MM-DD to Dutch d-m-jjjj
  function formatDateDMY(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // Calculate workdays (Mon–Fri) between two dates (inclusive)
  function calculateWorkdays(startDateString, endDateString) {
    if (!startDateString || !endDateString) return null;

    const start = new Date(startDateString);
    const end = new Date(endDateString);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return null;

    if (end < start) return { calendarDays: 0, workdays: 0 };

    const oneDayMs = 24 * 60 * 60 * 1000;
    let calendarDays =
      Math.floor(
        (end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / oneDayMs
      ) + 1;

    let workdays = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      const day = current.getDay(); // 0=Sunday, 6=Saturday
      if (day >= 1 && day <= 5) {
        workdays += 1;
      }
      current.setDate(current.getDate() + 1);
    }

    if (calendarDays < 0) {
      calendarDays = 0;
    }

    return { calendarDays, workdays };
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

  // Derived dates for run period card
  const startDateString = project?.start_date
    ? new Date(project.start_date).toISOString().split("T")[0]
    : null;
  const deadlineString = project?.due_date
    ? new Date(project.due_date).toISOString().split("T")[0]
    : null;

  function renderBudgetAndRunPeriodCards() {
    const parsedBudget =
      project?.budget_amount !== null && project?.budget_amount !== undefined
        ? Number(project.budget_amount)
        : null;
    const hasBudget =
      parsedBudget !== null && !Number.isNaN(parsedBudget) && parsedBudget >= 0;

    const period =
      startDateString && deadlineString
        ? calculateWorkdays(startDateString, deadlineString)
        : null;

    return (
      <div className="mt-6 space-y-4">
        {/* Project run period summary */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Looptijd van het project
          </h3>
          {startDateString && deadlineString && period ? (
            <div className="space-y-1 text-xs text-gray-700">
              <p>
                Startdatum:{" "}
                <span className="font-medium">
                  {formatDateDMY(startDateString)}
                </span>
              </p>
              <p>
                Deadline:{" "}
                <span className="font-medium">
                  {formatDateDMY(deadlineString)}
                </span>
              </p>
              <p>
                Totaal kalenderdagen:{" "}
                <span className="font-medium">{period.calendarDays}</span>
              </p>
              <p>
                Totaal werkdagen :{" "}
                <span className="font-medium">{period.workdays}</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              Stel zowel een startdatum als project deadline in om de looptijd
              te berekenen.
            </p>
          )}
        </div>

        {/* Budget vs expenses summary */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Uitgaven ten opzichte van projectbudget
          </h3>
          {loadingExpenses ? (
            <p className="text-xs text-gray-600">Uitgaven laden...</p>
          ) : expensesError ? (
            <p className="text-xs text-red-600">{expensesError}</p>
          ) : !expenseSummary ? (
            <p className="text-xs text-gray-600">
              Nog geen uitgaven gevonden voor dit project.
            </p>
          ) : (
            (() => {
              const totalExpenses = expenseSummary.totalExpenses || 0;
              const expenseCount = expenseSummary.expenseCount || 0;

              let statusText = "";
              let statusClass = "text-xs text-gray-700";

              if (hasBudget) {
                const remaining = parsedBudget - totalExpenses;
                if (remaining < 0) {
                  statusText = `Budget overschreden met ${formatMoney(
                    Math.abs(remaining)
                  )}.`;
                  statusClass = "text-xs text-red-600";
                } else if (remaining === 0) {
                  statusText = "Budget precies bereikt.";
                  statusClass = "text-xs text-amber-600";
                } else if (remaining <= parsedBudget * 0.1) {
                  statusText = `Bijna op budget, nog ${formatMoney(
                    remaining
                  )} over.`;
                  statusClass = "text-xs text-amber-600";
                } else {
                  statusText = `Binnen budget, nog ${formatMoney(
                    remaining
                  )} over.`;
                  statusClass = "text-xs text-green-600";
                }
              }

              return (
                <div className="space-y-1 text-xs text-gray-700">
                  <p>
                    Totaal aantal uitgaven:{" "}
                    <span className="font-medium">{expenseCount}</span>
                  </p>
                  <p>
                    Totaal uitgaven:{" "}
                    <span className="font-medium">
                      {formatMoney(totalExpenses)}
                    </span>
                  </p>
                  {hasBudget ? (
                    <p>
                      Ingesteld uitgavenbudget:{" "}
                      <span className="font-medium">
                        {formatMoney(parsedBudget)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Er is nog geen uitgavenbudget ingesteld. Vul het budget in
                      bij de instellingen om het te volgen.
                    </p>
                  )}
                  {hasBudget && <p className={statusClass}>{statusText}</p>}
                </div>
              );
            })()
          )}
        </div>
      </div>
    );
  }

  if (!forecast && !loading && !error) {
    return (
      <div className="mt-6 space-y-4">
        <button
          onClick={fetchForecast}
          disabled={loading}
          className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Project einddatum voorspellen
        </button>

        {/* Cards under forecast button */}
        {renderBudgetAndRunPeriodCards()}
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

      {/* Cards under forecast button */}
      {renderBudgetAndRunPeriodCards()}

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
