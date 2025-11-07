import Link from "next/link";
import NotesListClient from "./NotesListClient";

export const dynamic = "force-dynamic";

export default async function NotesPage({ params }) {
  const { user } = await params;

  // Mock data for Phase 1 - will be replaced with Supabase queries in Phase 2
  const mockNotes = [
    {
      id: "1",
      name: "Shopping List",
      project_id: null,
      created_by: user,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "2",
      name: "Meeting Notes",
      project_id: "mock-project-id", // Mock project ID - will show project name if project exists in store
      created_by: user,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

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
        <NotesListClient user={user} initialNotes={mockNotes} />
      </section>
    </main>
  );
}
