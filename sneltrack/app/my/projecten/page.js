import { Suspense } from "react";
import { getUserProjectsWithStats } from "@/lib/supabase/services/projectsService";
import Link from "next/link";
import ProjectsListClient from "./ProjectsListClient";
import ProjectsHydrator from "../ProjectsHydrator";
import BackButtonClient from "../projecten/[projectId]/BackButtonClient";
import { auth0 } from "@/lib/auth/auth0";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function ProjectsLoading({ user }) {
  return (
    <>
      <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl p-4 sm:p-2 flex flex-col gap-6">
        <section className="bg-white">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1">
              <BackButtonClient />
            </div>
            <h2 className="flex-1 text-center text-lg font-semibold">
              Projecten
            </h2>
            <div className="flex-1"></div>
          </div>

          <div className="text-center py-8 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
            <p className="mt-4 text-sm">Projecten laden...</p>
          </div>
        </section>
      </main>
    </>
  );
}

async function ProjectsContent({ user }) {
  const projects = await getUserProjectsWithStats(user);

  return (
    <>
      <ProjectsHydrator user={user} initialProjects={projects} />
      <main className=" flex flex-col gap-6">
        <section className=" bg-white  ">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1">
              <BackButtonClient />
            </div>
            <h2 className="flex-1 text-center text-lg font-semibold">
              Projecten
            </h2>
            <div className="flex-1"></div>
          </div>

          <div className="p-4">
            <ProjectsListClient user={user} initialProjects={projects} />
          </div>
        </section>
      </main>
    </>
  );
}

export default async function ProjectenPage({ params, request }) {
  const session = await auth0.getSession(request);

  if (!session?.user) {
    redirect("/auth/login");
  }
  const user = session.user.sub;

  return (
    <Suspense fallback={<ProjectsLoading user={user} />}>
      <ProjectsContent user={user} />
    </Suspense>
  );
}
