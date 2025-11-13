"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  DateRangeProvider,
  DateRangeSelector,
  useDateRangeContext,
} from "../components/DateRangeProvider";
import { getWeekBounds, getMonthBounds, getQuarterBounds } from "@/lib/time";

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

// Color palette for pie chart
const BILLABLE_COLOR = "#10b981"; // Green
const UNBILLABLE_COLOR = "#ef4444"; // Red

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
    <div className="bg-white rounded-xl p-4 mx-4 mb-6 border border-gray-200">
      <h2 className="text-base font-semibold text-gray-900 mb-4 text-center">
        Overzicht: Factureerbaar vs Niet Factureerbaar
      </h2>
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

function ProjectCard({ project, user }) {
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
    </div>
  );
}

function ReportsContent() {
  const pathname = usePathname();
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const userName = pathSegments[0] || "";
  const { rangeType, referenceDate } = useDateRangeContext();
  const [projects, setProjects] = useState([]);
  const [totals, setTotals] = useState({
    totalBillableHours: 0,
    totalUnbillableHours: 0,
    totalBillableAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReports() {
      if (!userName) return;

      setLoading(true);
      setError(null);

      try {
        // Calculate date range bounds
        let startDate, endDate;
        if (rangeType === "week") {
          const bounds = getWeekBounds(referenceDate);
          startDate = bounds.start;
          endDate = bounds.end;
        } else if (rangeType === "month") {
          const bounds = getMonthBounds(referenceDate);
          startDate = bounds.start;
          endDate = bounds.end;
        } else if (rangeType === "quarter") {
          const bounds = getQuarterBounds(referenceDate);
          startDate = bounds.start;
          endDate = bounds.end;
        } else {
          setLoading(false);
          return;
        }

        const url = new URL(
          `/${encodeURIComponent(userName)}/reports/api`,
          window.location.origin
        );
        url.searchParams.set("rangeType", rangeType);
        url.searchParams.set("referenceDate", referenceDate.toISOString());

        const res = await fetch(url);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to fetch reports (${res.status})`
          );
        }

        const data = await res.json();
        setProjects(data.projects || []);
        setTotals(
          data.totals || {
            totalBillableHours: 0,
            totalUnbillableHours: 0,
            totalBillableAmount: 0,
          }
        );
      } catch (err) {
        console.error("Error fetching reports:", err);
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [userName, rangeType, referenceDate]);

  if (!userName) {
    return null;
  }

  return (
    <section className="flex-1 mb-20">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-gray-600">Laden...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">
              Geen projecten met data in deze periode
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Overall Pie Chart */}
          <OverallPieChart totals={totals} />

          {/* Project List */}
          <div className="px-4 space-y-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} user={userName} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function ReportsClient() {
  const pathname = usePathname();
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const userName = pathSegments[0] || "";

  if (!userName) {
    return null;
  }

  const encodedUser = encodeURIComponent(userName);

  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4">
        <Link
          href={`/${encodedUser}`}
          prefetch={false}
          className="text-[#008eff] hover:underline"
        >
          ← Terug
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Reports</h1>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <section>
        {/* Date Range Provider wraps only the components that need it */}
        <DateRangeProvider>
          {/* Date Range Selector - at the top, above project name */}
          <div className="mb-6">
            <DateRangeSelector />
          </div>
          <ReportsContent />
        </DateRangeProvider>
      </section>
    </main>
  );
}
