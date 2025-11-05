import {
  getProjectById,
  getProjectStatisticsByMember,
  isProjectOwner,
  getProjectMembers,
} from "@/lib/dbFirestore";
import Link from "next/link";
import MemberHoursChart from "../MemberHoursChart";
import ProjectDetailClient from "./ProjectDetailClient";
import {
  DateRangeProvider,
  DateRangeSelector,
  ProjectStatistics,
} from "./ProjectStatisticsContainer";
import BackButtonClient from "./BackButtonClient";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }) {
  const { user, projectId } = await params;

  const project = await getProjectById(user, projectId);
  if (!project) {
    return (
      <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl p-4 sm:p-2">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Project niet gevonden</h2>
          <Link
            href={`/${encodeURIComponent(user)}/projecten`}
            className="text-[#008eff] hover:underline"
          >
            ← Terug naar projecten
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = project.is_shared
    ? await isProjectOwner(user, projectId)
    : true;
  const members = project.is_shared ? await getProjectMembers(projectId) : [];

  let memberStats = null;
  if (project.is_shared && isOwner) {
    memberStats = await getProjectStatisticsByMember(projectId);
  }

  return (
    <main className="flex flex-col ">
      <div className=" flex items-center justify-between p-4">
        <BackButtonClient />
      </div>
      <section className="bg-white rounded-xl">
        <div className="">
          {/* Date Range Provider wraps only the components that need it */}
          <DateRangeProvider>
            {/* Date Range Selector - at the top, above project name */}
            <div className="mb-6">
              <DateRangeSelector />
            </div>
            <div className="p-4">
              {/* Statistics - below project name */}
              <ProjectStatistics
                user={user}
                projectId={projectId}
                project={project}
              />
            </div>
            <div className="p-4">
              <div className="mb-6">
                <h1 className="text-lg font-bold text-gray-900 ">
                  {project.name}
                  {project.is_shared && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      {isOwner ? "Eigenaar" : "Gedeeld"}
                    </span>
                  )}
                </h1>
                <div className="flex flex-wrap mb-2">
                  {project.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Standaard
                    </span>
                  )}
                </div>

                {/* {project.hourly_rate && (
                <div className="text-sm text-gray-600 mb-2">
                  Tarief: {formatMoney(project.hourly_rate)}/uur
                </div>
              )} */}

                {project.budget_hours && (
                  <div className="text-sm text-gray-600">
                    Begroting: {project.budget_hours} uren
                  </div>
                )}
              </div>

              {/* Tabs Section */}
              <div className="mb-6">
                <ProjectDetailClient
                  user={user}
                  projectId={projectId}
                  project={project}
                  isOwner={isOwner}
                  initialMembers={members}
                  isShared={project.is_shared}
                />
              </div>
            </div>
          </DateRangeProvider>
        </div>
      </section>
    </main>
  );
}
