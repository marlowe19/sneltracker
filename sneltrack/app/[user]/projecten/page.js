import { getAllProjects } from "@/lib/dbFirestore";
import Link from "next/link";
import ProjectsListClient from "./ProjectsListClient";

export const dynamic = "force-dynamic";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function ProjectenPage({ params }) {
  const { user } = await params;
  const projects = await getAllProjects(user);

  return (
    <main className="container mx-auto max-w-md sm:max-w-xl md:max-w-2xl p-4 sm:p-2 flex flex-col gap-6">
      <section className=" bg-white  ">
        <div className="flex items-center justify-between">
          <h2 className="text-left text-lg font-semibold">Projecten</h2>
          <Link
            href={`/${encodeURIComponent(user)}`}
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
  );
}
