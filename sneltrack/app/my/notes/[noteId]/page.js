import Link from "next/link";
import NoteClient from "./NoteClient";
import { supabaseServer } from "@/lib/supabaseServer";
import NoteDetailClient from "./NoteDetailClient";
import { auth0 } from "@/lib/auth/auth0";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({ params, request }) {
  const session = await auth0.getSession(request);
  
  if (!session?.user) {
    redirect("/auth/login");
  }
  const user = session.user.nickname;
  const { noteId } = await params;

  // Fetch note and items from Supabase
  const { data: note, error: noteError } = await supabaseServer
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return (
      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4">
          <Link
            href="/my/notes"
            prefetch={false}
            className="text-[#008eff] hover:underline"
          >
            ← Terug
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Notitie</h1>
          <div className="w-16"></div>
        </div>
        <section className="bg-white rounded-xl p-4">
          <div className="text-center py-8 text-red-500">
            Notitie niet gevonden
          </div>
        </section>
      </main>
    );
  }

  // Check access
  if (note.created_by !== user && !note.share_token) {
    return (
      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4">
          <Link
            href="/my/notes"
            prefetch={false}
            className="text-[#008eff] hover:underline"
          >
            ← Terug
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Notitie</h1>
          <div className="w-16"></div>
        </div>
        <section className="bg-white rounded-xl p-4">
          <div className="text-center py-8 text-red-500">
            Geen toegang tot deze notitie
          </div>
        </section>
      </main>
    );
  }

  // Fetch items
  const { data: itemsRaw, error: itemsError } = await supabaseServer
    .from("note_items")
    .select("*")
    .eq("note_id", noteId)
    .order("position", { ascending: true });

  // Sort items: position 0 items first (newest first), then by position
  const items = itemsRaw
    ? [...itemsRaw].sort((a, b) => {
        if (a.position === 0 && b.position !== 0) return -1;
        if (a.position !== 0 && b.position === 0) return 1;
        if (a.position === 0 && b.position === 0) {
          // Both are new items, sort by created_at DESC (newest first)
          return new Date(b.created_at) - new Date(a.created_at);
        }
        return a.position - b.position;
      })
    : null;

  if (itemsError) {
    console.error("Error fetching note items:", itemsError);
  }

  return (
    <NoteDetailClient
      user={user}
      noteId={noteId}
      initialNote={note}
      initialItems={items || []}
    />
  );
}
