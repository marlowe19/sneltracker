import Link from "next/link";
import NotesListClient from "./NotesListClient";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function NotesPage({ params }) {
  const { user } = await params;

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
