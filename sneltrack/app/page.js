import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth/auth0";
import AnonymousTimerClient from "./components/AnonymousTimerClient";

export default async function Home({ request }) {
  // Check if user is logged in
  const session = await auth0.getSession(request);

  // If logged in, redirect to /my page
  if (session?.user) {
    redirect("/my");
  }

  // If not logged in, show anonymous timer page
  return (
    <main className="flex flex-col pt-4">
      <div className="flex items-center gap-2 justify-start p-4">
        <img
          src="/icon-SO.svg"
          alt="Snel tracker"
          className="w-16 h-16  mb-4"
        />
        <h1 className="text-2xl font-semibold text-gray-900">Snel tracker</h1>
      </div>
      <AnonymousTimerClient />
    </main>
  );
}
