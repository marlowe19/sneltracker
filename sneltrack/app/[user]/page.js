import { getActiveEntries, getStoppedTimersForToday } from "@/lib/dbFirestore";
import Link from "next/link";
import TimerSectionWrapperClient from "./TimerSectionWrapperClient";
import WeekEntriesClient from "./WeekEntriesClient";

export const dynamic = "force-dynamic";

export default async function UserPage({ params, searchParams }) {
  const { user } = await params;
  const weekOffset = Number((await searchParams)?.w || 0) || 0;
  // Fetch active entries and stopped timers for today on server
  const [activeEntries, stoppedTimers] = await Promise.all([
    getActiveEntries(user),
    getStoppedTimersForToday(user),
  ]);

  return (
    <main className=" mx-auto max-w-md sm:max-w-xl md:max-w-2xl flex flex-col h-screen overflow-hidden">
      <div className="flex relative w-full p-4">
        <div className="">
          <header className=" top-3 left-3 z-50">
            <img
              src="/icon-SO.svg"
              alt="SO icon"
              width="28"
              height="22"
              className="opacity-60"
            />
          </header>
        </div>

        <div className="ml-auto">
          <Link
            href={`/${encodeURIComponent(user)}/projecten`}
            className="text-base text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Projecten
          </Link>
        </div>
      </div>

      <TimerSectionWrapperClient
        user={user}
        activeEntries={activeEntries}
        stoppedTimers={stoppedTimers}
      />

      {/* Week entries section - client component with spinner */}
      <WeekEntriesClient user={user} weekOffset={weekOffset} />
    </main>
  );
}
