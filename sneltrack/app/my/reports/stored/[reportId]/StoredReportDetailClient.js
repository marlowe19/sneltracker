"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import BackButtonClient from "../../../projecten/[projectId]/BackButtonClient";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useDateRangeContext } from "../../../components/DateRangeProvider";
import PieChartCarousel from "../../PieChartCarousel";
import { HOURLY_RATE_BREAKDOWN } from "@/lib/hourlyRateBreakdown";
import ReportItemsManager from "./ReportItemsManager";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(totalHours) {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
}

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

function formatDateShort(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatFilters(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return null;
  }

  const parts = [];

  // Date range
  if (filters.customStartDate && filters.customEndDate) {
    parts.push(
      `Periode: ${formatDateShort(filters.customStartDate)} - ${formatDateShort(
        filters.customEndDate,
      )}`,
    );
  } else if (filters.rangeType && filters.referenceDate) {
    const rangeTypeLabels = {
      week: "Week",
      month: "Maand",
      quarter: "Kwartaal",
    };
    const label = rangeTypeLabels[filters.rangeType] || filters.rangeType;
    const refDate = formatDateShort(filters.referenceDate);
    parts.push(`${label}: ${refDate}`);
  }

  // Projects filter
  if (filters.selectedProjectIds && filters.selectedProjectIds.length > 0) {
    parts.push(
      `${filters.selectedProjectIds.length} ${
        filters.selectedProjectIds.length === 1 ? "project" : "projecten"
      } geselecteerd`,
    );
  } else {
    parts.push("Alle projecten");
  }

  // Billable filter
  const billableLabels = {
    billable: "Alleen factureerbaar",
    "non-billable": "Alleen niet factureerbaar",
    both: "Factureerbaar en niet factureerbaar",
  };
  parts.push(
    billableLabels[filters.billableFilter] ||
      "Factureerbaar en niet factureerbaar",
  );

  // Include expenses
  parts.push(
    filters.includeExpenses !== false
      ? "Uitgaven inbegrepen"
      : "Uitgaven uitgesloten",
  );

  return parts;
}

// Color palette for pie chart
const BILLABLE_COLOR = "#10b981"; // Green
const UNBILLABLE_COLOR = "#ef4444"; // Red

// Color palette for category breakdown pie chart
const COLORS = [
  "#008eff", // Primary blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

function OverallPieChart({ totals }) {
  const pieData = [
    {
      name: "Factureerbaar",
      value: parseFloat(totals.totalBillableHours.toFixed(2)),
      hours: totals.totalBillableHours,
      color: BILLABLE_COLOR,
    },
    {
      name: "Niet factureerbaar",
      value: parseFloat(totals.totalUnbillableHours.toFixed(2)),
      hours: totals.totalUnbillableHours,
      color: UNBILLABLE_COLOR,
    },
  ].filter((item) => item.hours > 0);

  const hasData =
    totals.totalBillableHours > 0 || totals.totalUnbillableHours > 0;
  const totalHours = totals.totalBillableHours + totals.totalUnbillableHours;

  if (!hasData) {
    return null;
  }

  return (
    <div className="w-full">
      <div style={{ height: "250px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => {
                if (percent > 0.05) {
                  return `${(percent * 100).toFixed(0)}%`;
                }
                return "";
              }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => [
                `${formatHours(props.payload.hours)} (${value.toFixed(2)}u)`,
                props.payload.name,
              ]}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-6">
        {pieData.map((item) => {
          const percent = totalHours > 0 ? (item.hours / totalHours) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-700">
                {item.name}: {formatHours(item.hours)} ({percent.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
      {totals.totalBillableAmount > 0 && (
        <div className="mt-4 text-center">
          <span className="text-sm text-gray-600">Totaal factureerbaar: </span>
          <span className="text-lg font-semibold text-green-600">
            {formatMoney(totals.totalBillableAmount)}
          </span>
        </div>
      )}
    </div>
  );
}

function CategoryBreakdownPieChart({ totals }) {
  if (!totals.totalBillableAmount || totals.totalBillableAmount <= 0) {
    return null;
  }

  const breakdownData = HOURLY_RATE_BREAKDOWN.map((item) => ({
    name: item.category,
    percentage: item.percentage,
    amount: totals.totalBillableAmount * (item.percentage / 100),
  }));

  return (
    <div className="w-full">
      <div style={{ height: "230px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 30, right: 30, bottom: 10, left: 30 }}>
            <Pie
              data={breakdownData}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={({ percentage, amount }) => {
                if (percentage > 5) {
                  return `€${amount.toFixed(1)}`;
                }
                return "";
              }}
              outerRadius={70}
              innerRadius={40}
              fill="#8884d8"
              dataKey="percentage"
            >
              {breakdownData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => [
                `${formatMoney(props.payload.amount)} (${value}%)`,
                props.payload.name,
              ]}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2">
        {breakdownData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: COLORS[index % COLORS.length],
              }}
            />
            <span className="text-xs text-gray-700">
              {item.name}: {formatMoney(item.amount)} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project, user }) {
  const [showMembers, setShowMembers] = useState(false);
  const hasMembers = project.members && project.members.length > 0;

  return (
    <div className="border border-[#ffa540] bg-[#fff9e5] rounded-lg p-4 hover:bg-gray-50 transition-colors">
      {/* Title row with badges */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-base font-semibold text-gray-900">
          {project.name}
        </h3>
        {project.is_default && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
            Standaard
          </span>
        )}
        {project.is_shared && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
            {project.owner === user ? "Eigenaar" : "Gedeeld"}
          </span>
        )}
        {hasMembers && (
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
            {project.members.length}{" "}
            {project.members.length === 1 ? "lid" : "leden"}
          </span>
        )}
      </div>

      {/* Statistics row in columns */}
      <div className="flex flex-row gap-4 text-sm">
        {/* Total Hours */}
        <div className="flex-1 text-gray-700">
          <div className="font-medium text-gray-600 mb-1">Uren</div>
          <div>{formatHours(project.statistics.totalHours)}</div>
        </div>

        {/* Hourly Rate */}
        <div className="flex-1 text-gray-700">
          <div className="font-medium text-gray-600 mb-1">Uurtarief</div>
          <div>
            {project.hourlyRate && project.hourlyRate > 0
              ? formatMoney(project.hourlyRate)
              : "-"}
          </div>
        </div>

        {/* Billable Amount */}
        <div className="flex-1 text-gray-700">
          <div className="font-medium text-gray-600 mb-1">Bedrag</div>
          <div>
            {project.billableAmount > 0 ? (
              <span className="text-green-600 font-semibold">
                {formatMoney(project.billableAmount)}
              </span>
            ) : (
              "-"
            )}
          </div>
        </div>

        {/* Expenses */}
        <div className="flex-1 text-gray-700">
          <div className="font-medium text-gray-600 mb-1">Uitgaven</div>
          <div>
            {project.totalExpenses > 0 ? (
              <span className="text-red-600 font-semibold">
                {formatMoney(project.totalExpenses)}
              </span>
            ) : (
              "-"
            )}
          </div>
        </div>
      </div>

      {/* Member Breakdown Section */}
      {hasMembers && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full"
          >
            <span>{showMembers ? "▼" : "▶"}</span>
            <span>Leden overzicht</span>
          </button>

          {showMembers && (
            <div className="mt-3 space-y-2">
              {project.members.map((member) => {
                const memberBillableAmount =
                  member.billableHours * (project.hourlyRate || 0);
                return (
                  <div
                    key={member.user_name}
                    className="bg-white rounded-lg p-3 border border-gray-200"
                  >
                    <div className="font-medium text-gray-900 mb-2">
                      {member.user_display_name || member.user_name}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Totaal: </span>
                        {formatHours(member.hours)}
                      </div>
                      <div>
                        <span className="font-medium">Factureerbaar: </span>
                        {formatHours(member.billableHours)}
                      </div>
                      <div>
                        <span className="font-medium">
                          Niet factureerbaar:{" "}
                        </span>
                        {formatHours(member.unbillableHours)}
                      </div>
                      {memberBillableAmount > 0 && (
                        <div>
                          <span className="font-medium">Bedrag: </span>
                          <span className="text-green-600 font-semibold">
                            {formatMoney(memberBillableAmount)}
                          </span>
                        </div>
                      )}
                      {member.expenses > 0 && (
                        <div>
                          <span className="font-medium">Uitgaven: </span>
                          <span className="text-red-600 font-semibold">
                            {formatMoney(member.expenses)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Tijdregistraties: </span>
                        {member.entryCount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StoredReportDetailClient({ report, userName }) {
  const router = useRouter();
  const pathname = usePathname();
  const { handleRangeChange } = useDateRangeContext();
  const [deleting, setDeleting] = useState(false);

  const reportData = report.report_data || {};
  const projects = reportData.projects || [];
  const totals = reportData.totals || {
    totalBillableHours: 0,
    totalUnbillableHours: 0,
    totalBillableAmount: 0,
  };
  const filters = reportData.filters || {};

  const handleDelete = async () => {
    if (!confirm("Weet je zeker dat je dit rapport wilt verwijderen?")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/my/reports/stored/api?id=${report.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete report");
      }
      router.push(pathname.replace(/\/stored\/[^/]+$/, ""));
    } catch (err) {
      console.error("Error deleting report:", err);
      alert("Fout bij verwijderen van rapport");
    } finally {
      setDeleting(false);
    }
  };

  const handleApplyFilters = () => {
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
      },
    );

    // Navigate to main reports page
    const basePath = pathname.replace(/\/stored\/[^/]+$/, "") || "/my/reports";
    router.push(basePath);
  };

  // Build cards array for carousel
  const cards = [];
  const hasOverallData =
    totals.totalBillableHours > 0 || totals.totalUnbillableHours > 0;
  const hasCategoryData =
    totals.totalBillableAmount && totals.totalBillableAmount > 0;

  if (hasOverallData) {
    cards.push({
      id: "overall-pie-chart",
      title: "Overzicht: Factureerbaar vs Niet Factureerbaar",
      content: <OverallPieChart totals={totals} />,
    });
  }

  if (hasCategoryData) {
    cards.push({
      id: "category-breakdown",
      title: `Verdeling van totale opbrengst van ${formatMoney(
        totals.totalBillableAmount,
      )}`,
      content: <CategoryBreakdownPieChart totals={totals} />,
    });
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between py-4">
        <BackButtonClient />
        <h1 className="text-lg font-bold text-gray-900">Opgeslagen Rapport</h1>
        <div className="w-16"></div>
      </div>
      <section className="px-4 mb-20">
        {/* Report Metadata */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            {report.name}
          </h2>
          {report.description && (
            <p className="text-sm text-gray-600 mb-2">{report.description}</p>
          )}
          <p className="text-xs text-gray-500 mb-3">
            Opgeslagen op {formatDate(report.created_at)}
          </p>

          {/* Filters used when report was saved */}
          {(() => {
            const filterList = formatFilters(filters);
            return filterList && filterList.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Filters gebruikt bij opslaan:
                </p>
                <div className="space-y-1">
                  {filterList.map((filterText, index) => (
                    <p key={index} className="text-xs text-gray-600">
                      • {filterText}
                    </p>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {deleting ? "Verwijderen..." : "Verwijderen"}
            </button>
          </div>

          {/* Report Items Manager */}
          <ReportItemsManager reportId={report.id} filters={filters} />
        </div>

        {/* Report Content */}
        {projects.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-lg text-gray-600">
                Geen projecten in dit rapport
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Carousel with Pie Chart Cards */}
            {cards.length > 0 && <PieChartCarousel cards={cards} />}

            {/* Project List */}
            <div className="space-y-3 mt-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  user={userName}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
