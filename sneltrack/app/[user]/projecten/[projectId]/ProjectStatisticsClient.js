"use client";

import { useState, useEffect, useRef } from "react";
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
} from "recharts";
import { HOURLY_RATE_BREAKDOWN } from "@/lib/hourlyRateBreakdown";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const carouselRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    async function fetchStatistics() {
      setLoading(true);
      setError(null);

      try {
        // Fetch statistics from API without date range parameters
        const url = new URL(
          `/${encodeURIComponent(user)}/projecten/${projectId}/api`,
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
          {/* User Hours Breakdown Pie Chart */}
          {memberStatistics && memberStatistics.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium text-gray-700 mb-3">
                Verdeling per gebruiker
              </div>
              <div style={{ height: "200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Pie
                      data={memberStatistics.map((member) => ({
                        name: member.user_name,
                        value: parseFloat(member.totalHours.toFixed(2)),
                        hours: member.totalHours,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        if (percent > 0.1) {
                          return `${(percent * 100).toFixed(0)}%`;
                        }
                        return "";
                      }}
                      outerRadius={60}
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
              <div className="mt-4 flex flex-col gap-2">
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
          {/* User Hours Breakdown Pie Chart */}
          {memberStatistics && memberStatistics.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-3">
                Verdeling per gebruiker
              </div>
              <div style={{ height: "200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Pie
                      data={memberStatistics.map((member) => ({
                        name: member.user_name,
                        value: parseFloat(member.totalHours.toFixed(2)),
                        hours: member.totalHours,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        if (percent > 0.1) {
                          return `${(percent * 100).toFixed(0)}%`;
                        }
                        return "";
                      }}
                      outerRadius={60}
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
              <div className="mt-4 flex flex-col gap-2">
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

  const totalCards = cards.length;

  // Card width percentage (92% leaves ~8% visible for next card)
  const CARD_WIDTH_PERCENT = 92;
  const CARD_GAP_PERCENT = 2; // Gap as percentage of container width

  // Calculate transform percentage
  // Each card takes CARD_WIDTH_PERCENT + CARD_GAP_PERCENT of the container
  const getTransformPercent = () => {
    const step = CARD_WIDTH_PERCENT + CARD_GAP_PERCENT;
    const baseOffset = currentIndex * step;
    // Calculate drag offset as percentage
    const dragOffsetPercent = containerRef.current
      ? (dragOffset / containerRef.current.offsetWidth) * 100
      : 0;
    return -(baseOffset - dragOffsetPercent);
  };

  // Touch handlers with improved mobile support
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!touchStartX.current || !touchStartY.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Only prevent scroll if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      touchEndX.current = currentX;
      setDragOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) {
      setIsDragging(false);
      setDragOffset(0);
      touchStartX.current = null;
      touchEndX.current = null;
      touchStartY.current = null;
      return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance && currentIndex < totalCards - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (distance < -minSwipeDistance && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }

    setIsDragging(false);
    setDragOffset(0);
    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
  };

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    touchStartX.current = e.clientX;
    setIsDragging(true);
    if (carouselRef.current) {
      carouselRef.current.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e) => {
    if (touchStartX.current !== null && isDragging) {
      e.preventDefault();
      touchEndX.current = e.clientX;
      setDragOffset(e.clientX - touchStartX.current);
    }
  };

  const handleMouseUp = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const distance = touchStartX.current - touchEndX.current;
      const minSwipeDistance = 50;

      if (distance > minSwipeDistance && currentIndex < totalCards - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (distance < -minSwipeDistance && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }

    setIsDragging(false);
    setDragOffset(0);
    touchStartX.current = null;
    touchEndX.current = null;
    if (carouselRef.current) {
      carouselRef.current.style.cursor = "grab";
    }
  };

  const goToCard = (index) => {
    setCurrentIndex(index);
    setDragOffset(0);
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistieken</h2>

      {totalCards > 0 && (
        <>
          {/* Carousel Container */}
          <div
            ref={containerRef}
            className="relative overflow-hidden pb-4"
            style={{
              marginLeft: "-4px",
              marginRight: "-4px",
              paddingLeft: "4px",
              paddingRight: "4px",
            }}
          >
            <div
              ref={carouselRef}
              className="flex select-none min-h-[400px]"
              style={{
                transform: `translateX(${getTransformPercent()}%)`,
                cursor: isDragging ? "grabbing" : "grab",
                transition: isDragging ? "none" : "transform 0.3s ease-out",
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                setIsDragging(false);
                setDragOffset(0);
                touchStartX.current = null;
                touchEndX.current = null;
                if (carouselRef.current) {
                  carouselRef.current.style.cursor = "grab";
                }
              }}
            >
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="shrink-0"
                  style={{
                    width: `${CARD_WIDTH_PERCENT}%`,
                    marginRight:
                      index < totalCards - 1 ? `${CARD_GAP_PERCENT}%` : "0",
                  }}
                >
                  <div className="bg-white rounded-xl p-4 shadow-md select-text h-full min-h-[320px]">
                    <div className="text-sm text-gray-600 mb-3 font-medium">
                      {card.title}
                    </div>
                    {card.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots Indicator */}
          {totalCards > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {cards.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToCard(index)}
                  className={`transition-all ${
                    index === currentIndex
                      ? "w-2 h-2 bg-[#008eff] rounded-full"
                      : "w-2 h-2 bg-gray-300 rounded-full hover:bg-gray-400"
                  }`}
                  aria-label={`Go to card ${index + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
