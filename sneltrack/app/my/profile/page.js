import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth/auth0";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ request }) {
  const session = await auth0.getSession(request);

  if (!session?.user) {
    redirect("/auth/login");
  }

  const user = session.user;
  const nickname = user.nickname || "";
  const email = user.email || "";
  const name = user.name || "";
  const address = user.user_metadata?.address || user.address || "";

  return (
    <main className="mx-auto max-w-md sm:max-w-xl md:max-w-2xl flex flex-col h-dvh overflow-hidden">
      <div className="flex relative w-full p-4">
        <div className="">
          <header className="top-3 left-3 z-50">
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

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Profiel</h1>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">
                Gebruikersnaam
              </label>
              <p className="mt-1 text-base text-gray-900">
                {nickname || "Niet beschikbaar"}
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="mt-1 text-base text-gray-900">
                {email || "Niet beschikbaar"}
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-500">Naam</label>
              <p className="mt-1 text-base text-gray-900">
                {name || "Niet beschikbaar"}
              </p>
            </div>

            {/* <div className="border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-500">Adres</label>
              <p className="mt-1 text-base text-gray-900">
                {address || "Niet beschikbaar"}
              </p>
            </div> */}
            <div className="border-t border-gray-200 pt-4">
              <div className="text-xs px-4">App versie: 2.1.1</div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/auth/logout"
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Uitloggen
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
