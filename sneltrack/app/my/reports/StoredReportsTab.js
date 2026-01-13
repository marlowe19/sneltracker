"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { formatDateForAPI } from "@/lib/dateRangeUtils";
import { useDateRangeContext } from "../components/DateRangeProvider";

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function StoredReportsTab({ userName }) {
  const router = useRouter();
  const pathname = usePathname();
  const { handleRangeChange } = useDateRangeContext();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function fetchReports() {
      if (!userName) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/my/reports/stored/api`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `Failed to fetch stored reports (${res.status})`
          );
        }
        const data = await res.json();
        setReports(data.reports || []);
      } catch (err) {
        console.error("Error fetching stored reports:", err);
        setError(err.message || "Failed to load stored reports");
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [userName]);

  const handleDelete = async (reportId, e) => {
    e.stopPropagation();
    if (!confirm("Weet je zeker dat je dit rapport wilt verwijderen?")) {
      return;
    }

    setDeletingId(reportId);
    try {
      const res = await fetch(`/my/reports/stored/api?id=${reportId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to delete report"
        );
      }
      setReports(reports.filter((r) => r.id !== reportId));
    } catch (err) {
      console.error("Error deleting report:", err);
      alert("Fout bij verwijderen van rapport");
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewDetails = (reportId) => {
    // Remove any existing /stored path and add the new one
    const basePath = pathname.replace(/\/stored.*$/, "") || pathname;
    router.push(`${basePath}/stored/${reportId}`);
  };

  const handleApplyFilters = async (reportId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/my/reports/stored/api?id=${reportId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to fetch report"
        );
      }
      const report = await res.json();
      const filters = report.report_data?.filters;

      if (filters) {
        // Apply filters to DateRangeProvider
        const referenceDate = filters.referenceDate
          ? new Date(filters.referenceDate)
          : new Date();
        const customStartDate = filters.customStartDate
          ? new Date(filters.customStartDate)
          : null;
        const customEndDate = filters.customEndDate
          ? new Date(filters.customEndDate)
          : null;

        handleRangeChange(
          filters.rangeType || "week",
          referenceDate,
          customStartDate,
          customEndDate,
          {
            selectedProjectIds: filters.selectedProjectIds || [],
            billableFilter: filters.billableFilter || "both",
            includeExpenses: filters.includeExpenses !== false,
          }
        );

        // Navigate to main reports page (remove /stored if present)
        const basePath = pathname.replace(/\/stored.*$/, "") || pathname;
        router.push(basePath);
      }
    } catch (err) {
      console.error("Error applying filters:", err);
      alert("Fout bij toepassen van filters");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-lg text-gray-600">Geen opgeslagen rapporten</p>
          <p className="text-sm text-gray-500 mt-2">
            Sla een rapport op vanuit het "Huidig Rapport" tabblad
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3 mb-20">
      {reports.map((report) => (
        <div
          key={report.id}
          className="border border-gray-200 bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => handleViewDetails(report.id)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900">
                {report.name}
              </h3>
              {report.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {report.description}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Opgeslagen op {formatDate(report.created_at)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleViewDetails(report.id)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Bekijken
            </button>
            {/* <button
              onClick={(e) => handleApplyFilters(report.id, e)}
              className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
            >
              Filters toepassen
            </button> */}
            <button
              onClick={(e) => handleDelete(report.id, e)}
              disabled={deletingId === report.id}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {deletingId === report.id ? "Verwijderen..." : "Verwijderen"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
