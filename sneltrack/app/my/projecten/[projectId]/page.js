import { getProjectDetail } from "@/lib/supabase/services/projectsService";
import Link from "next/link";
import MemberHoursChart from "../MemberHoursChart";
import ProjectDetailClient from "./ProjectDetailClient";
import { ProjectStatistics } from "./ProjectStatisticsContainer";
import BackButtonClient from "./BackButtonClient";
import { auth0 } from "@/lib/auth/auth0";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params, request }) {
  const session = await auth0.getSession(request);

  if (!session?.user) {
    redirect("/auth/login");
  }
  const user = session.user.sub;
  const { projectId } = await params;

  // Get project detail with all data in ONE query (migrated to Supabase)
  const projectDetail = await getProjectDetail(user, projectId);
  if (!projectDetail) {
    return (
      <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl pt-4 sm:p-2">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Project niet gevonden</h2>
          <Link
            href={`/my/projecten`}
            prefetch={false}
            className="text-[#008eff] hover:underline"
          >
            ← Terug naar projecten
          </Link>
        </div>
      </main>
    );
  }

  // Extract data from single query result
  const project = projectDetail;
  const isOwner = projectDetail.is_owner;
  const members = projectDetail.members || [];
  const memberStats = projectDetail.memberStatistics || null;

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Header with back button and centered project name */}
      <div className="relative flex items-center justify-between p-4 flex-shrink-0">
        <BackButtonClient />
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">Project</h1>
        </div>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <section className="w-full flex items-center justify-center flex-shrink-0">
        <h1 className="text-base  text-gray-900">{project.name}</h1>
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
      </section>
      <section className="bg-white rounded-xl flex-1 min-h-0 overflow-y-auto">
        <div
          className="p-4"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          {/* Tabs Section - moved to top */}
          <ProjectDetailClient
            user={user}
            projectId={projectId}
            project={project}
            isOwner={isOwner}
            initialMembers={members}
            initialMemberStats={memberStats}
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
