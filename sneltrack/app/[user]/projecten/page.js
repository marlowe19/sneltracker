import { Suspense } from "react";
import { getAllProjects } from "@/lib/dbFirestore";
import Link from "next/link";
import ProjectsListClient from "./ProjectsListClient";
import ProjectsHydrator from "../ProjectsHydrator";

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
          <div className="flex items-center justify-between">
            <h2 className="text-left text-lg font-semibold">Projecten</h2>
            <Link
              href={`/${encodeURIComponent(user)}`}
              prefetch={false}
              className="text-base text-gray-600 hover:text-gray-900"
            >
              ← Terug
            </Link>
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
  const projects = await getAllProjects(user);

  return (
    <>
      <ProjectsHydrator user={user} initialProjects={projects} />
      <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl p-4 sm:p-2 flex flex-col gap-6">
        <section className=" bg-white  ">
          <div className="flex items-center justify-between">
            <h2 className="text-left text-lg font-semibold">Projecten</h2>
            <Link
              href={`/${encodeURIComponent(user)}`}
              prefetch={false}
              className="text-base text-gray-600 hover:text-gray-900"
            >
              ← Terug
            </Link>
          </div>

          <div className="">
            <ProjectsListClient user={user} initialProjects={projects} />
          </div>
        </section>
      </main>
    </>
  );
}

export default async function ProjectenPage({ params }) {
  const { user } = await params;

  return (
    <Suspense fallback={<ProjectsLoading user={user} />}>
      <ProjectsContent user={user} />
    </Suspense>
  );
}
