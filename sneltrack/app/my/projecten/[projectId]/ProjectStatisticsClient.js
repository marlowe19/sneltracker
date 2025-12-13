"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { HOURLY_RATE_BREAKDOWN } from "@/lib/hourlyRateBreakdown";
import PieChartCarousel from "../../reports/PieChartCarousel";

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

export default function ProjectStatisticsClient({ user, projectId, project }) {
  const [statistics, setStatistics] = useState(null);
  const [memberStatistics, setMemberStatistics] = useState(null);
  const [velocity, setVelocity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStatistics() {
      setLoading(true);
      setError(null);

      try {
        // Fetch statistics from API without date range parameters
        const url = new URL(
          `/my/projecten/${projectId}/api`,
          window.location.origin
        );

        const res = await fetch(url);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("API Error:", {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
            url: url.toString(),
          });
          throw new Error(
            errorData.error || `Failed to fetch statistics (${res.status})`
          );
        }

        const data = await res.json();
        setStatistics(data.statistics);
        setMemberStatistics(data.memberStatistics || null);
        setVelocity(data.velocity || null);
      } catch (err) {
        console.error("Error fetching statistics:", err);
        setError(err.message || "Failed to load statistics");
      } finally {
        setLoading(false);
      }
    }

    fetchStatistics();
  }, [user, projectId]);

  if (loading) {
    return (
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Statistieken
        </h2>
        <div className="text-sm text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Statistieken
        </h2>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  // Build cards array
  const cards = [];

  // Card 2: Pie chart or Totaal waarde
  if (memberStatistics && memberStatistics.length > 1) {
    cards.push({
      id: "member-hours",
      title: "Uren per gebruiker",
      content: (
        <div className="w-full">
          <div style={{ height: "240px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 30, right: 30, bottom: 20, left: 30 }}>
                <Pie
                  data={memberStatistics.map((member) => ({
                    name: member.user_name,
                    value: parseFloat(member.totalHours.toFixed(2)),
                    hours: member.totalHours,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => {
                    if (percent > 0.05) {
                      return `${name}\n${(percent * 100).toFixed(0)}%`;
                    }
                    return "";
                  }}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {memberStatistics.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${formatHours(props.payload.hours)} (${value.toFixed(
                      2
                    )}u)`,
                    "Uren",
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
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {memberStatistics.map((member, index) => (
              <div key={member.user_name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
                <span className="text-xs text-gray-700">
                  {member.user_name}: {formatHours(member.totalHours)}
                </span>
              </div>
            ))}
          </div>
          {/* Budget Progress Bar */}
          {statistics.budgetHours && (
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    statistics.isOverBudget
                      ? "bg-red-500"
                      : statistics.budgetPercentage > 80
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: `${
                      statistics.budgetPercentage !== null
                        ? Math.min(statistics.budgetPercentage, 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <span>
                  {statistics.totalHours.toFixed(1)} / {statistics.budgetHours}{" "}
                  uren
                </span>
                <span>
                  {statistics.budgetPercentage !== null
                    ? `${statistics.budgetPercentage.toFixed(1)}%`
                    : "-"}
                </span>
              </div>
            </div>
          )}
          {/* User Hours Breakdown - Labels only */}
          {memberStatistics && memberStatistics.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium text-gray-700 mb-3">
                Verdeling per gebruiker
              </div>
              <div className="flex flex-col gap-2">
                {memberStatistics.map((member, index) => (
                  <div
                    key={member.user_name}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <div className="flex flex-col text-xs text-gray-700">
                      <div className="font-medium">{member.user_name}</div>
                      <div className="text-gray-600">
                        {formatHours(member.totalHours)}
                        {project.hourly_rate && (
                          <> · {formatMoney(project.hourly_rate)}/uur</>
                        )}
                        {member.totalMoney > 0 && (
                          <> · {formatMoney(member.totalMoney)}</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
  } else {
    cards.push({
      id: "total-value",
      title: "",
      content: (
        <div>
          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <div className="text-sm font-medium text-gray-600">
                Totaal waarde
              </div>
              <div className="text-sm font-medium text-gray-600">
                Totaal uren
              </div>
            </div>
            <div className="flex justify-between items-baseline">
              <div className="text-xl font-bold text-gray-900">
                {formatMoney(statistics.totalMoney)}
              </div>
              <div className="text-lg font-semibold text-gray-700">
                {formatHours(statistics.totalHours)}
              </div>
            </div>
          </div>
          {/* Budget Progress Bar */}
          {statistics.budgetHours && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    statistics.isOverBudget
                      ? "bg-red-500"
                      : statistics.budgetPercentage > 80
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: `${
                      statistics.budgetPercentage !== null
                        ? Math.min(statistics.budgetPercentage, 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <span>
                  {statistics.totalHours.toFixed(1)} / {statistics.budgetHours}{" "}
                  uren
                </span>
                <span>
                  {statistics.budgetPercentage !== null
                    ? `${statistics.budgetPercentage.toFixed(1)}%`
                    : "-"}
                </span>
              </div>
            </div>
          )}
          {/* User Hours Breakdown - Labels only */}
          {memberStatistics && memberStatistics.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-3">
                Verdeling per gebruiker
              </div>
              <div className="flex flex-col gap-2">
                {memberStatistics.map((member, index) => (
                  <div
                    key={member.user_name}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <div className="flex flex-col text-xs text-gray-700">
                      <div className="font-medium">{member.user_name}</div>
                      <div className="text-gray-600">
                        {formatHours(member.totalHours)}
                        {project.hourly_rate && (
                          <> · {formatMoney(project.hourly_rate)}/uur</>
                        )}
                        {member.totalMoney > 0 && (
                          <> · {formatMoney(member.totalMoney)}</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
  }

  // Card 3: Totaal waarde (if multiple members)
  if (memberStatistics && memberStatistics.length > 1) {
    cards.push({
      id: "total-value-members",
      title: "",
      content: (
        <div>
          <div className="mb-2">
            <div className="flex justify-between items-baseline mb-2">
              <div className="text-sm font-medium text-gray-600">
                Totaal waarde
              </div>
              <div className="text-sm font-medium text-gray-600">
                Totaal uren
              </div>
            </div>
            <div className="flex justify-between items-baseline">
              <div className="text-xl font-bold text-gray-900">
                {formatMoney(statistics.totalMoney)}
              </div>
              <div className="text-lg font-semibold text-gray-700">
                {formatHours(statistics.totalHours)}
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  // Card 4: Hourly Rate Breakdown Pie Chart
  if (project.hourly_rate) {
    const breakdownData = HOURLY_RATE_BREAKDOWN.map((item) => ({
      name: item.category,
      percentage: item.percentage,
      amount: project.hourly_rate * (item.percentage / 100),
    }));

    cards.push({
      id: "hourly-rate-breakdown",
      title: `Verdeling van een uurtarief van ${formatMoney(
        project.hourly_rate
      )}`,
      content: (
        <div className="w-full">
          <div style={{ height: "240px" }} className="relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 30, right: 30, bottom: 20, left: 30 }}>
                <Pie
                  data={breakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ percentage, amount }) => {
                    // Only show label if slice is large enough (e.g., > 5%)
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
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {formatMoney(project.hourly_rate)}
                </div>
                <div className="text-xs text-gray-600">per uur</div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            {breakdownData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
                <span className="text-xs text-gray-700">
                  {item.name}: ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Card 5: Total Money Breakdown Pie Chart
  if (statistics.totalMoney > 0 && project.hourly_rate) {
    const totalBreakdownData = HOURLY_RATE_BREAKDOWN.map((item) => ({
      name: item.category,
      percentage: item.percentage,
      amount: statistics.totalMoney * (item.percentage / 100),
    }));

    cards.push({
      id: "total-money-breakdown",
      title: `Verdeling van totale opbrengst van ${formatMoney(
        statistics.totalMoney
      )}`,
      content: (
        <div className="w-full">
          <div style={{ height: "240px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 30, right: 30, bottom: 20, left: 30 }}>
                <Pie
                  data={totalBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ percentage, amount }) => {
                    // Only show label if slice is large enough (e.g., > 5%)
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
                  {totalBreakdownData.map((entry, index) => (
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
          <div className="mt-6 flex flex-col gap-2">
            {totalBreakdownData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
                <span className="text-xs text-gray-700">
                  {item.name}: ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Card 6: Budget Progress Chart
  if (statistics.budgetHours && project.hourly_rate) {
    const budgetData = [
      {
        name: "Uren",
        budget: statistics.budgetHours,
        actual: statistics.totalHours,
      },
      {
        name: "Geld",
        budget:
          statistics.budgetPrice ||
          statistics.budgetHours * project.hourly_rate,
        actual: statistics.totalMoney,
      },
    ];

    // Calculate max value for Y-axis scaling
    const maxHours = Math.max(statistics.budgetHours, statistics.totalHours);
    const maxMoney = Math.max(
      statistics.budgetPrice || statistics.budgetHours * project.hourly_rate,
      statistics.totalMoney
    );

    cards.push({
      id: "budget-progress",
      title: "Budget vs Actueel",
      content: (
        <div className="w-full" style={{ height: "200px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={budgetData}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={(value) => {
                  // Format based on whether it's hours or money
                  if (value < 1000) {
                    return value.toFixed(0);
                  }
                  return (value / 1000).toFixed(1) + "k";
                }}
              />
              <Tooltip
                formatter={(value, name, props) => {
                  const dataPoint = props.payload;
                  const isHours = dataPoint.name === "Uren";
                  if (isHours) {
                    return [
                      `${value.toFixed(1)} uren`,
                      name === "budget" ? "Budget" : "Actueel",
                    ];
                  } else {
                    return [
                      formatMoney(value),
                      name === "budget" ? "Budget" : "Actueel",
                    ];
                  }
                }}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem" }}
                formatter={(value) =>
                  value === "budget" ? "Budget" : "Actueel"
                }
              />
              <Bar
                dataKey="budget"
                fill="#10b981"
                name="Budget"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="actual"
                fill="#008eff"
                name="Actueel"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    });
  } else if (statistics.budgetHours) {
    // Fallback to simple budget card if no hourly rate
    cards.push({
      id: "budget",
      title: "Budget",
      content: (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>
              {statistics.totalHours.toFixed(1)} / {statistics.budgetHours} uren
            </span>
            <span
              className={
                statistics.isOverBudget
                  ? "text-red-600 font-semibold"
                  : "text-gray-600"
              }
            >
              {statistics.budgetPercentage !== null
                ? `${statistics.budgetPercentage.toFixed(1)}%`
                : "-"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${
                statistics.isOverBudget
                  ? "bg-red-500"
                  : statistics.budgetPercentage > 80
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${
                  statistics.budgetPercentage !== null
                    ? Math.min(statistics.budgetPercentage, 100)
                    : 0
                }%`,
              }}
            />
          </div>
          {statistics.budgetPrice !== null && project.hourly_rate && (
            <div className="text-xs text-gray-500 mt-2">
              Budget: {formatMoney(statistics.budgetPrice)} | Actueel:{" "}
              {formatMoney(statistics.totalMoney)}
            </div>
          )}
        </div>
      ),
    });
  }

  // Velocity Cards
  if (velocity && velocity.dailyVelocity && velocity.dailyVelocity.length > 0) {
    // Format daily velocity data for chart
    const dailyChartData = velocity.dailyVelocity.map((item) => ({
      date: new Date(item.date).toLocaleDateString("nl-NL", {
        month: "short",
        day: "numeric",
      }),
      hours: parseFloat(item.hours),
      fullDate: item.date,
    }));

    // Card: Daily Velocity Chart
    cards.push({
      id: "daily-velocity",
      title: "Dagelijkse snelheid (uren per dag)",
      content: (
        <div className="w-full" style={{ height: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dailyChartData}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={(value) => `${value.toFixed(1)}u`}
              />
              <Tooltip
                formatter={(value) => [`${value.toFixed(2)}u`, "Uren"]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return new Date(
                      payload[0].payload.fullDate
                    ).toLocaleDateString("nl-NL", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    });
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#008eff"
                strokeWidth={2}
                dot={{ fill: "#008eff", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    });

    // Card: Velocity Metrics Summary
    const trendEmoji =
      velocity.trendDirection === "increasing"
        ? "📈"
        : velocity.trendDirection === "decreasing"
        ? "📉"
        : "➡️";
    const trendColor =
      velocity.trendDirection === "increasing"
        ? "text-green-600"
        : velocity.trendDirection === "decreasing"
        ? "text-red-600"
        : "text-gray-600";

    cards.push({
      id: "velocity-metrics",
      title: "Snelheidsmetrieken",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-600 mb-1">
                Gemiddeld per dag
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {formatHours(velocity.averageDailyHours)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Actieve dagen</div>
              <div className="text-lg font-semibold text-gray-900">
                {velocity.activeDays}
              </div>
            </div>
          </div>
          {velocity.peakDayDate && (
            <div>
              <div className="text-xs text-gray-600 mb-1">Topdag</div>
              <div className="text-sm font-medium text-gray-900">
                {new Date(velocity.peakDayDate).toLocaleDateString("nl-NL", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="text-xs text-gray-600">
                {formatHours(velocity.peakDayHours)}
              </div>
            </div>
          )}
          {velocity.trendDirection !== "insufficient_data" && (
            <div>
              <div className="text-xs text-gray-600 mb-1">Trend</div>
              <div
                className={`text-sm font-medium ${trendColor} flex items-center gap-1`}
              >
                <span>{trendEmoji}</span>
                <span>
                  {velocity.trendDirection === "increasing"
                    ? "Toenemend"
                    : velocity.trendDirection === "decreasing"
                    ? "Afnemend"
                    : "Stabiel"}
                </span>
                {Math.abs(velocity.trendPercentage) > 0 && (
                  <span className="text-xs">
                    ({velocity.trendPercentage > 0 ? "+" : ""}
                    {velocity.trendPercentage.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ),
    });

    // Card: Weekly Velocity (if we have weekly data)
    if (velocity.weeklyVelocity && velocity.weeklyVelocity.length > 0) {
      const weeklyChartData = velocity.weeklyVelocity.map((item) => ({
        week: new Date(item.weekStart).toLocaleDateString("nl-NL", {
          month: "short",
          day: "numeric",
        }),
        hours: parseFloat(item.hours),
        fullWeekStart: item.weekStart,
      }));

      cards.push({
        id: "weekly-velocity",
        title: "Wekelijkse snelheid",
        content: (
          <div className="w-full" style={{ height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyChartData}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                  tickFormatter={(value) => `${value.toFixed(1)}u`}
                />
                <Tooltip
                  formatter={(value) => [`${value.toFixed(2)}u`, "Uren"]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const weekStart = new Date(
                        payload[0].payload.fullWeekStart
                      );
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekEnd.getDate() + 6);
                      return `Week: ${weekStart.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                      })} - ${weekEnd.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                      })}`;
                    }
                    return label;
                  }}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="hours" fill="#008eff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      });
    }
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistieken</h2>
      <PieChartCarousel cards={cards} />
    </div>
  );
}
