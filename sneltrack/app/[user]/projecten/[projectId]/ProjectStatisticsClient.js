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

export default function ProjectStatisticsClient({
  user,
  projectId,
  project,
  rangeType,
  referenceDate,
}) {
  const [statistics, setStatistics] = useState(null);
  const [memberStatistics, setMemberStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
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
        // Calculate date bounds
        let bounds;
        if (rangeType === "week") {
          bounds = getWeekBounds(referenceDate);
        } else if (rangeType === "month") {
          bounds = getMonthBounds(referenceDate);
        } else if (rangeType === "quarter") {
          bounds = getQuarterBounds(referenceDate);
        } else {
          bounds = getWeekBounds(referenceDate);
        }

        // Fetch statistics from API
        const url = new URL(
          `/${encodeURIComponent(user)}/projecten/${projectId}/api`,
          window.location.origin
        );
        url.searchParams.set("rangeType", rangeType);
        url.searchParams.set("referenceDate", bounds.start.toISOString());
        // Send both start and end to avoid timezone recalculation issues
        url.searchParams.set("startDate", bounds.start.toISOString());
        url.searchParams.set("endDate", bounds.end.toISOString());

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

    if (rangeType && referenceDate) {
      fetchStatistics();
    }
  }, [user, projectId, rangeType, referenceDate]);

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
        </div>
      ),
    });
  } else {
    cards.push({
      id: "total-value",
      title: "Totaal waarde",
      content: (
        <div className="text-xl font-bold text-gray-900">
          {formatMoney(statistics.totalMoney)}
        </div>
      ),
    });
  }

  // Card 3: Totaal waarde (if multiple members)
  if (memberStatistics && memberStatistics.length > 1) {
    cards.push({
      id: "total-value-members",
      title: "Totaal waarde",
      content: (
        <div className="text-xl font-bold text-gray-900">
          {formatMoney(statistics.totalMoney)}
        </div>
      ),
    });
  }

  // Card 4: Budget Progress Chart
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

  // Card 5: Profitability
  if (
    statistics.budgetHours !== null &&
    statistics.hoursSaved !== null &&
    project.hourly_rate
  ) {
    cards.push({
      id: "profitability",
      title: "Winstgevendheid",
      content: (
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Bespaarde uren</div>
              <div
                className={`text-xl font-bold ${
                  statistics.hoursSaved > 0
                    ? "text-green-600"
                    : statistics.hoursSaved < 0
                    ? "text-red-600"
                    : "text-gray-900"
                }`}
              >
                {statistics.hoursSaved > 0 ? "+" : ""}
                {formatHours(statistics.hoursSaved * 60 * 60 * 1000)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Budget gebruik</div>
              <div
                className={`text-xl font-bold ${
                  statistics.budgetPercentage !== null
                    ? statistics.budgetPercentage < 80
                      ? "text-green-600"
                      : statistics.budgetPercentage <= 100
                      ? "text-yellow-600"
                      : "text-red-600"
                    : "text-gray-900"
                }`}
              >
                {statistics.budgetPercentage !== null
                  ? `${statistics.budgetPercentage.toFixed(1)}%`
                  : "-"}
              </div>
            </div>
          </div>

          {/* Profitability Status Indicator */}
          {statistics.profitabilityStatus && (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    statistics.profitabilityStatus === "profitable"
                      ? "bg-green-500"
                      : statistics.profitabilityStatus === "at_risk"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-gray-700">
                  {statistics.profitabilityStatus === "profitable"
                    ? "Winstgevend - Onder 80% van budget gebruikt"
                    : statistics.profitabilityStatus === "at_risk"
                    ? "Risico - Dicht bij budget (80-100%)"
                    : "Over budget - Meer dan 100% gebruikt"}
                </span>
              </div>
            </div>
          )}

          {/* Additional context */}
          {statistics.moneySaved !== null && statistics.moneySaved > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              <div>
                Bespaard: {formatMoney(statistics.moneySaved)} | Budget:{" "}
                {formatMoney(statistics.budgetPrice)} | Gebruikt:{" "}
                {formatMoney(statistics.totalMoney)}
              </div>
            </div>
          )}
          {statistics.hoursSaved !== null && statistics.hoursSaved < 0 && (
            <div className="mt-3 text-xs text-red-500">
              <div>
                Over budget:{" "}
                {formatHours(Math.abs(statistics.hoursSaved) * 60 * 60 * 1000)}{" "}
                | Extra kosten:{" "}
                {formatMoney(
                  Math.abs(statistics.hoursSaved) * project.hourly_rate
                )}
              </div>
            </div>
          )}
          {statistics.hoursSaved !== null &&
            statistics.hoursSaved === 0 &&
            statistics.budgetPercentage !== null &&
            statistics.budgetPercentage === 100 && (
              <div className="mt-3 text-xs text-gray-500">
                <div>
                  Exact op budget: {formatMoney(statistics.budgetPrice)} |{" "}
                  Gebruikt: {formatMoney(statistics.totalMoney)}
                </div>
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
