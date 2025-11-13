import { Suspense } from "react";
import {
  getActiveEntries,
  getStoppedTimersForToday,
  getAllProjects,
} from "@/lib/dbFirestore";
import Link from "next/link";
import TimerSectionWrapperClient from "./TimerSectionWrapperClient";
import WeekEntriesClient from "./WeekEntriesClient";
import ProjectsHydrator from "./ProjectsHydrator";
import { useStore } from "@/stores/useStore";

export const dynamic = "force-dynamic";

function UserPageLoading({ user }) {
  return (
    <>
      <main className=" mx-auto max-w-md sm:max-w-xl md:max-w-2xl flex flex-col h-dvh overflow-hidden">
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

          <div className="ml-auto flex gap-2">
            <Link
              href={`/${encodeURIComponent(user)}/notes`}
              prefetch={false}
              className="text-base text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Notities (test)
            </Link>
            <Link
              href={`/${encodeURIComponent(user)}/projecten`}
              prefetch={false}
              className="text-base text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Projecten
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
            <p className="mt-4 text-sm text-gray-500">Laden...</p>
          </div>
        </div>
      </main>
    </>
  );
}

async function UserPageContent({ user, weekOffset }) {
  // Fetch active entries, stopped timers, and projects on server
  const [activeEntries, stoppedTimers, projects] = await Promise.all([
    getActiveEntries(user),
    getStoppedTimersForToday(user),
    getAllProjects(user),
  ]);

  return (
    <>
      <ProjectsHydrator user={user} initialProjects={projects} />
      <main className=" mx-auto max-w-md sm:max-w-xl md:max-w-2xl flex flex-col h-dvh overflow-hidden">
        {/* Week entries section - client component with spinner */}
        <WeekEntriesClient user={user} weekOffset={weekOffset} />
        <TimerSectionWrapperClient
          user={user}
          activeEntries={activeEntries}
          stoppedTimers={stoppedTimers}
        />
      </main>
    </>
  );
}

export default async function UserPage({ params, searchParams }) {
  const { user } = await params;
  const weekOffset = Number((await searchParams)?.w || 0) || 0;

  return (
    <Suspense fallback={<UserPageLoading user={user} />}>
      <UserPageContent user={user} weekOffset={weekOffset} />
    </Suspense>
  );
}
