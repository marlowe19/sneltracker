import { Suspense } from "react";
import { getActiveEntries } from "@/lib/supabase/services/timeEntriesService";
import { getUserProjectsWithStats } from "@/lib/supabase/services/projectsService";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth/auth0";
import Link from "next/link";
import TimerSectionWrapperClient from "./TimerSectionWrapperClient";
import WeekEntriesClient from "./WeekEntriesClient";
import ProjectsHydrator from "./ProjectsHydrator";
import { useStore } from "@/stores/useStore";
import CalendarViewClient from "./components/CalendarViewClient";
import SyncOnLoginClient from "../components/SyncOnLoginClient";

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
  const [activeEntries, projects] = await Promise.all([
    getActiveEntries(user),
    getUserProjectsWithStats(user),
  ]);

  return (
    <>
      <ProjectsHydrator user={user} initialProjects={projects} />
      <SyncOnLoginClient user={user} />
      <main className=" mx-auto max-w-md sm:max-w-xl md:max-w-2xl flex flex-col h-dvh overflow-hidden">
        {/* Week entries section - client component with spinner */}
        <WeekEntriesClient user={user} weekOffset={weekOffset} />
        {/* <CalendarViewClient viewType="week" user={user} /> */}
        <TimerSectionWrapperClient
          user={user}
          activeEntries={activeEntries}
          stoppedTimers={[]}
        />
      </main>
    </>
  );
}

export default async function UserPage({ params, searchParams, request }) {
  const session = await auth0.getSession(request);

  const weekOffset = Number((await searchParams)?.w || 0) || 0;

  if (!session?.user) {
    redirect("/auth/login");
  }
  const user = session.user.sub;
  return (
    <Suspense fallback={<UserPageLoading user={user} />}>
      <UserPageContent user={user} weekOffset={weekOffset} />
    </Suspense>
  );
}
