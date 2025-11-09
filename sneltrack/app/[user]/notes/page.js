import { Suspense } from "react";
import Link from "next/link";
import NotesListClient from "./NotesListClient";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function NotesLoading({ user }) {
  return (
    <main className="flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Link
          href={`/${encodeURIComponent(user)}`}
          prefetch={false}
          className="text-[#008eff] hover:underline"
        >
          ← Terug
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Notities</h1>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <section className="bg-white rounded-xl p-4">
        <div className="text-center py-8 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008eff]"></div>
          <p className="mt-4 text-sm">Notities laden...</p>
        </div>
      </section>
    </main>
  );
}

async function NotesContent({ user }) {
  // Fetch notes from Supabase
  const { data: notes, error } = await supabaseServer
    .from("notes")
    .select("*")
    .eq("created_by", user)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
  }

  return (
    <main className="flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Link
          href={`/${encodeURIComponent(user)}`}
          prefetch={false}
          className="text-[#008eff] hover:underline"
        >
          ← Terug
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Notities</h1>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <section className="bg-white rounded-xl p-4">
        <NotesListClient user={user} initialNotes={notes || []} />
      </section>
    </main>
  );
}

export default async function NotesPage({ params }) {
  const { user } = await params;

  return (
    <Suspense fallback={<NotesLoading user={user} />}>
      <NotesContent user={user} />
    </Suspense>
  );
}
