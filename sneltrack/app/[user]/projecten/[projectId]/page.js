import {
  getProjectById,
  getProjectStatisticsByMember,
  isProjectOwner,
  getProjectMembers,
} from "@/lib/dbFirestore";
import Link from "next/link";
import MemberHoursChart from "../MemberHoursChart";
import ProjectDetailClient from "./ProjectDetailClient";
import { ProjectStatistics } from "./ProjectStatisticsContainer";
import BackButtonClient from "./BackButtonClient";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }) {
  const { user, projectId } = await params;

  const project = await getProjectById(user, projectId);
  if (!project) {
    return (
      <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl pt-4 sm:p-2">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Project niet gevonden</h2>
          <Link
            href={`/${encodeURIComponent(user)}/projecten`}
            prefetch={false}
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
      {/* Header with back button and centered project name */}
      <div className="relative flex items-center justify-between p-4">
        <BackButtonClient />
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-2">
            {project.is_shared && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                {isOwner ? "Eigenaar" : "Gedeeld"}
              </span>
            )}
            {project.is_default && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Standaard
              </span>
            )}
          </div>
        </div>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <section className="bg-white rounded-xl">
        <div className="p-4">
          {/* Tabs Section - moved to top */}
          <ProjectDetailClient
            user={user}
            projectId={projectId}
            project={project}
            isOwner={isOwner}
            initialMembers={members}
            isShared={project.is_shared}
            statisticsComponent={
              <ProjectStatistics
                user={user}
                projectId={projectId}
                project={project}
              />
            }
          />
        </div>
      </section>
    </main>
  );
}
