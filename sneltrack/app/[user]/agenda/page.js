"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Car } from "@carbon/icons-react";

export default function AgendaPage() {
  const pathname = usePathname();
  const router = useRouter();
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const userName = pathSegments[0] || "";

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  if (!userName) {
    return null;
  }

  const encodedUser = encodeURIComponent(userName);

  // Generate consistent colors for projects
  const projectColors = useMemo(() => {
    if (!data?.planning) return {};
    const colors = [
      "#8B0000", // Dark red
      "#228B22", // Green
      "#4169E1", // Light blue
      "#8B4513", // Reddish brown
      "#FFA500", // Orange-yellow
      "#9370DB", // Purple
      "#FF1493", // Deep pink
      "#00CED1", // Dark turquoise
      "#FF6347", // Tomato
      "#32CD32", // Lime green
      "#1E90FF", // Dodger blue
      "#FFD700", // Gold
    ];
    const colorMap = {};
    let colorIndex = 0;

    data.planning.days?.forEach((day) => {
      day.items?.forEach((item) => {
        if (item.projectId && !colorMap[item.projectId]) {
          colorMap[item.projectId] = colors[colorIndex % colors.length];
          colorIndex++;
        }
      });
    });

    return colorMap;
  }, [data?.planning]);

  const handlePlan = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/${encodedUser}/api/agenda`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Failed to generate planning: ${response.status}`
        );
      }

      const agendaData = await response.json();
      setData(agendaData);
    } catch (err) {
      console.error("Error generating planning:", err);
      setError(err.message || "Failed to generate planning");
    } finally {
      setLoading(false);
    }
  };

  function formatTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function isAllDay(start, end) {
    if (!start || !end) return false;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    // Consider all-day if it's 23+ hours (allowing for timezone differences)
    return diffHours >= 23;
  }

  function getItemColor(item) {
    if (item.type === "travel") {
      return "#808080"; // Gray for travel
    }
    if (item.type === "break") {
      return "#D3D3D3"; // Light gray for breaks
    }
    if (item.projectId && projectColors[item.projectId]) {
      return projectColors[item.projectId];
    }
    return "#6B7280"; // Default gray
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between py-4">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold text-gray-900">AI Planner</h1>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <section className="px-4 pb-8">
        <div className="mb-6">
          <button
            onClick={handlePlan}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Wijsneus Plan Mijn Week"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {data?.planning && (
          <div className="space-y-6">
            {data.planning.days?.map((day) => (
              <div
                key={day.date}
                className="bg-white rounded-lg border border-gray-200"
              >
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {formatDate(day.date)}
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {day.items?.length > 0 ? (
                    day.items.map((item) => {
                      const isAllDayItem = isAllDay(item.start, item.end);
                      const itemColor = getItemColor(item);

                      return (
                        <div
                          key={item.id}
                          className="flex items-start p-4 hover:bg-gray-50 transition-colors"
                        >
                          {/* Colored vertical bar */}
                          <div
                            className="w-1 h-full min-h-[40px] mr-3 flex-shrink-0 rounded"
                            style={{ backgroundColor: itemColor }}
                          />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              {item.type === "travel" && (
                                <Car
                                  size={20}
                                  className="text-gray-600 flex-shrink-0 mt-0.5"
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-900">
                                    {item.title}
                                  </span>
                                  {item.type === "travel" && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                      Reistijd
                                    </span>
                                  )}
                                  {item.type === "break" && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                      Pauze
                                    </span>
                                  )}
                                </div>
                                {isAllDayItem ? (
                                  <div className="text-sm text-gray-600 mt-1">
                                    Hele dag
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-600 mt-1">
                                    {formatTime(item.start)} -{" "}
                                    {formatTime(item.end)}
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Geen items gepland voor deze dag
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data && !data.planning && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="font-semibold text-gray-900 mb-2">Date Range</h2>
              <p className="text-sm text-gray-600">
                {data.dateRange?.start} to {data.dateRange?.end}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="font-semibold text-gray-900 mb-2">
                Calendar Events ({data.calendarEvents?.length || 0})
              </h2>
              {data.calendarEvents && data.calendarEvents.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {data.calendarEvents.slice(0, 10).map((event, idx) => (
                    <li key={event.id || idx} className="text-gray-700">
                      <span className="font-medium">{event.title}</span>
                      {event.start && (
                        <span className="text-gray-500 ml-2">
                          {new Date(event.start).toLocaleString()}
                        </span>
                      )}
                    </li>
                  ))}
                  {data.calendarEvents.length > 10 && (
                    <li className="text-gray-500 italic">
                      ... and {data.calendarEvents.length - 10} more events
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  No calendar events found
                </p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="font-semibold text-gray-900 mb-2">
                Active Projects ({data.projects?.length || 0})
              </h2>
              {data.projects && data.projects.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {data.projects.map((project) => (
                    <li
                      key={project.id}
                      className="border-b border-gray-200 pb-2 last:border-0"
                    >
                      <div className="font-medium text-gray-900">
                        {project.name}
                      </div>
                      <div className="text-gray-600 mt-1">
                        {project.hours_remaining !== null ? (
                          <>
                            {project.hours_remaining.toFixed(1)}h remaining
                            {project.hours_spent > 0 && (
                              <>
                                {" "}
                                (of {project.budget_hours}h,{" "}
                                {project.hours_spent.toFixed(1)}h spent)
                              </>
                            )}
                          </>
                        ) : (
                          <>No budget set</>
                        )}
                        {project.days_until_due !== null && (
                          <span className="ml-2">
                            • Due in {project.days_until_due} days
                          </span>
                        )}
                        {project.priority && (
                          <span className="ml-2">
                            • Priority: {project.priority}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  No active projects found
                </p>
              )}
            </div>

            {data.holidays && data.holidays.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="font-semibold text-gray-900 mb-2">
                  Holidays ({data.holidays.length})
                </h2>
                <ul className="space-y-1 text-sm text-gray-600">
                  {data.holidays.map((holiday, idx) => (
                    <li key={idx}>{holiday}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Click "Wijsneus Plan Mijn Week" to
                generate the AI planning.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
