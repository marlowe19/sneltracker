"use client";

import { useState } from "react";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(durationMs) {
  if (!durationMs) return "0u";
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.round((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STATUS_LABELS = {
  draft: "Concept",
  pending: "In behandeling",
  billed: "Gefactureerd",
  paid: "Betaald",
};

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  billed: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

export default function ReportItemsManager({ reportId, filters }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("timeEntries");
  const [timeEntries, setTimeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTimeEntries, setSelectedTimeEntries] = useState(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState(new Set());
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [updating, setUpdating] = useState(false);

  const handleExpand = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/my/reports/stored/${reportId}/items/api?reportId=${reportId}`
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to fetch items"
        );
      }
      const data = await res.json();
      setTimeEntries(data.timeEntries || []);
      setExpenses(data.expenses || []);
    } catch (err) {
      console.error("Error fetching report items:", err);
      setError(err.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTimeEntry = (id) => {
    const newSelected = new Set(selectedTimeEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTimeEntries(newSelected);
  };

  const handleSelectExpense = (id) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedExpenses(newSelected);
  };

  const handleSelectAllTimeEntries = () => {
    if (selectedTimeEntries.size === timeEntries.length) {
      setSelectedTimeEntries(new Set());
    } else {
      setSelectedTimeEntries(new Set(timeEntries.map((e) => e.id)));
    }
  };

  const handleSelectAllExpenses = () => {
    if (selectedExpenses.size === expenses.length) {
      setSelectedExpenses(new Set());
    } else {
      setSelectedExpenses(new Set(expenses.map((e) => e.id)));
    }
  };

  const handleBulkUpdate = async () => {
    const timeEntryIds = Array.from(selectedTimeEntries);
    const expenseIds = Array.from(selectedExpenses);

    if (timeEntryIds.length === 0 && expenseIds.length === 0) {
      alert("Selecteer minimaal één item om bij te werken");
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/my/reports/stored/${reportId}/items/api`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeEntryIds,
          expenseIds,
          status: selectedStatus,
          reportId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to update status"
        );
      }

      const result = await res.json();
      alert(
        `${result.updated.total} item(s) bijgewerkt naar "${STATUS_LABELS[selectedStatus]}"`
      );

      // Refresh data
      const refreshRes = await fetch(
        `/my/reports/stored/${reportId}/items/api?reportId=${reportId}`
      );
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setTimeEntries(refreshData.timeEntries || []);
        setExpenses(refreshData.expenses || []);
      }

      // Clear selections
      setSelectedTimeEntries(new Set());
      setSelectedExpenses(new Set());
    } catch (err) {
      console.error("Error updating status:", err);
      alert(`Fout bij bijwerken: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const currentItems = activeTab === "timeEntries" ? timeEntries : expenses;
  const selectedCount =
    activeTab === "timeEntries"
      ? selectedTimeEntries.size
      : selectedExpenses.size;
  const allSelected =
    currentItems.length > 0 && selectedCount === currentItems.length;

  return (
    <div className="mt-4 pt-3 border-t border-gray-200">
      <button
        onClick={handleExpand}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full"
      >
        <span>{isExpanded ? "▼" : "▶"}</span>
        <span>Rapport items beheren</span>
      </button>

      {isExpanded && (
        <div className="mt-3">
          {loading ? (
            <div className="text-sm text-gray-600 py-4">Laden...</div>
          ) : error ? (
            <div className="text-sm text-red-600 py-4">{error}</div>
          ) : timeEntries.length === 0 && expenses.length === 0 ? (
            <div className="text-sm text-gray-600 py-4">
              Geen items gevonden die overeenkomen met de filters van dit rapport
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("timeEntries")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "timeEntries"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Tijdregistraties ({timeEntries.length})
                </button>
                <button
                  onClick={() => setActiveTab("expenses")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "expenses"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Uitgaven ({expenses.length})
                </button>
              </div>

              {/* Bulk Actions */}
              {currentItems.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={
                        activeTab === "timeEntries"
                          ? handleSelectAllTimeEntries
                          : handleSelectAllExpenses
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {allSelected
                        ? "Alles deselecteren"
                        : `Alles selecteren (${selectedCount} geselecteerd)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-sm text-gray-700">Status:</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkUpdate}
                      disabled={selectedCount === 0 || updating}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? "Bijwerken..." : "Toepassen"}
                    </button>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activeTab === "timeEntries" ? (
                  timeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTimeEntries.has(entry.id)}
                        onChange={() => handleSelectTimeEntry(entry.id)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {entry.project_name || "Geen project"}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              STATUS_COLORS[entry.billing_status] ||
                              STATUS_COLORS.draft
                            }`}
                          >
                            {STATUS_LABELS[entry.billing_status] || "Concept"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>
                            {formatDateTime(entry.start_time)}
                            {entry.end_time &&
                              ` - ${new Date(entry.end_time).toLocaleTimeString("nl-NL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                          </div>
                          <div>
                            {formatHours(entry.duration_ms)} •{" "}
                            {entry.hourly_rate
                              ? formatMoney(entry.hourly_rate)
                              : "-"}{" "}
                            / uur
                            {entry.billable === false && (
                              <span className="ml-2 text-red-600">
                                (Niet factureerbaar)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedExpenses.has(expense.id)}
                        onChange={() => handleSelectExpense(expense.id)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {expense.name}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              STATUS_COLORS[expense.billing_status] ||
                              STATUS_COLORS.draft
                            }`}
                          >
                            {STATUS_LABELS[expense.billing_status] || "Concept"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>
                            {expense.project_name || "Geen project"} •{" "}
                            {formatDate(expense.date)}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatMoney(expense.price || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

