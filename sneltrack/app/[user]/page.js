import { getActiveEntry, getWeekEntries } from "@/lib/dbFirestore";
import { getWeekBounds, toIso, computeEntryDurationMs } from "@/lib/time";
import Link from "next/link";
import TimerSectionClient from "./TimerSectionClient";

export const dynamic = "force-dynamic";

function formatHoursShort(ms) {
  const h = Math.round((ms / (60 * 60 * 1000)) * 100) / 100;
  return `${h}h`;
}

function formatHoursHMM(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function UserPage({ params, searchParams }) {
  const { user } = await params;
  const weekOffset = Number((await searchParams)?.w || 0) || 0;
  const active = await getActiveEntry(user);
  const referenceDate = new Date(
    new Date().getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000
  );
  const { start: weekStart, end: weekEnd } = getWeekBounds(referenceDate);
  const entries = await getWeekEntries(user, toIso(weekStart), toIso(weekEnd));

  const perDay = Array(7).fill(0);
  const perDayMoney = Array(7).fill(0);

  for (const e of entries) {
    const duration = computeEntryDurationMs(e.start_time, e.end_time);
    const dow = new Date(e.start_time).getDay();
    const idx = (dow + 6) % 7; // Monday=0
    perDay[idx] += duration;

    // Calculate money for this entry
    if (e.hourly_rate) {
      const hours = duration / (1000 * 60 * 60);
      const money = hours * e.hourly_rate;
      perDayMoney[idx] += money;
    }
  }

  const maxMs = Math.max(1, ...perDay);
  const weekTotalTime = perDay.reduce((sum, val) => sum + val, 0);
  const weekTotalMoney = perDayMoney.reduce((sum, val) => sum + val, 0);

  return (
    <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl p-4 sm:p-6 flex flex-col gap-6">
      <section className="panel bg-white rounded-xl shadow">
        <div className="panel-header flex items-center justify-start gap-3 flex-wrap">
          <h2 className="text-left text-lg font-semibold">
            Hi{" "}
            <span className="text-gray-700 inline-block capitalize">
              {user},
            </span>
          </h2>
        </div>

        <TimerSectionClient user={user} active={active} />
      </section>

      <section className="panel">
        <div className="flex items-center justify-between mb-1">
          <Link
            href={`/${encodeURIComponent(user)}?w=${weekOffset - 1}`}
            className="px-2 py-1 rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Previous week"
          >
            ‹
          </Link>
          <Link
            href={`/${encodeURIComponent(user)}?w=0`}
            className="px-2.5 py-0.5 rounded-full border text-xs text-gray-700 hover:bg-gray-100"
            aria-label="Ga naar deze week"
          >
            Vandaag:{" "}
            {new Date().toLocaleDateString("nl-NL", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Link>
          <Link
            href={`/${encodeURIComponent(user)}?w=${weekOffset + 1}`}
            className="px-2 py-1 rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Next week"
          >
            ›
          </Link>
        </div>
        <div className="week grid grid-cols-7 gap-1 items-start">
          {[
            "Maandag",
            "Dinsdag",
            "Woensdag",
            "Donderdag",
            "Vrijdag",
            "Zaterdag",
            "Zondag",
          ].map((d, i) => (
            <div
              className="day flex flex-col items-center text-center gap-1"
              key={d}
            >
              {(() => {
                const dayDate = new Date(
                  weekStart.getTime() + i * 24 * 60 * 60 * 1000
                );
                const isToday =
                  new Date().toDateString() === dayDate.toDateString();
                return (
                  <>
                    <div className="day-label text-[10px] tracking-wide text-gray-500 uppercase whitespace-nowrap text-center">
                      <span className="sm:hidden">
                        {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][i]}
                      </span>
                      <span className="hidden sm:inline">{d.slice(0, 3)}</span>
                    </div>
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                        isToday
                          ? "bg-[#008eff] text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {dayDate.getDate()}
                    </div>
                  </>
                );
              })()}
              <div className="day-hours text-xs font-medium mt-1 tabular-nums">
                {perDay[i] ? formatHoursHMM(perDay[i]) : "0:00"}
              </div>
              {perDayMoney[i] > 0 && (
                <div className="day-money text-[10px] font-medium text-gray-600 mt-0.5 tabular-nums">
                  {formatMoney(perDayMoney[i])}
                </div>
              )}
              <div className="sr-only">
                <span className="sm:hidden">
                  {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][i]}
                </span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">
              Week Totaal
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm tabular-nums">
                <span className="text-gray-600">Tijd: </span>
                <span className="font-medium">
                  {formatHoursHMM(weekTotalTime)}
                </span>
              </div>
              {weekTotalMoney > 0 && (
                <div className="text-sm tabular-nums">
                  <span className="text-gray-600">Geld: </span>
                  <span className="font-medium">
                    {formatMoney(weekTotalMoney)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
