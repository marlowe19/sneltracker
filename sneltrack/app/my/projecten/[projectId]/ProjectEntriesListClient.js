"use client";

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

export default function ProjectEntriesListClient({
  user,
  projectId,
  type,
  data,
  loading,
}) {
  const timeEntries = data?.timeEntries || [];
  const expenses = data?.expenses || [];

  // Debug: log data to see what we're receiving
  if (process.env.NODE_ENV === "development") {
    console.log("ProjectEntriesListClient:", { type, data, timeEntries, expenses });
  }

  if (loading) {
    return <div className="text-sm text-gray-600 py-4">Laden...</div>;
  }

  // Show loading if data is null (not yet fetched)
  if (!data) {
    return <div className="text-sm text-gray-600 py-4">Laden...</div>;
  }

  if (type === "timeEntries") {
    if (timeEntries.length === 0) {
      return (
        <div className="text-sm text-gray-600 py-4">
          Geen tijdregistraties gevonden voor dit project
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {timeEntries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {entry.project_name || "Geen project"}
                </span>
                {entry.user_display_name && (
                  <span className="text-xs text-gray-500">
                    door {entry.user_display_name}
                  </span>
                )}
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
        ))}
      </div>
    );
  }

  if (type === "expenses") {
    if (expenses.length === 0) {
      return (
        <div className="text-sm text-gray-600 py-4">
          Geen uitgaven gevonden voor dit project
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {expense.name}
                </span>
                {expense.user_display_name && (
                  <span className="text-xs text-gray-500">
                    door {expense.user_display_name}
                  </span>
                )}
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
        ))}
      </div>
    );
  }

  return null;
}

