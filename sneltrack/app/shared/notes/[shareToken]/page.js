import { supabaseServer } from "@/lib/supabaseServer";
import SharedNoteClient from "./SharedNoteClient";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { shareToken } = await params;

  // Get base URL
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    try {
      const headersList = headers();
      const host = headersList.get("host");
      const protocol = headersList.get("x-forwarded-proto") || "https";
      if (host) {
        baseUrl = `${protocol}://${host}`;
      }
    } catch (error) {
      // If headers() fails, use fallback
      console.warn("Could not get base URL from headers:", error);
    }
  }

  // Final fallback if still no URL
  if (!baseUrl) {
    baseUrl = "https://sneltrack.vercel.app";
  }

  const shareUrl = `${baseUrl}/shared/notes/${shareToken}`;
  const imageUrl = `${baseUrl}/appimages/ios/app-logo-512.png`;

  try {
    // Fetch note by share_token
    const { data: note, error: noteError } = await supabaseServer
      .from("notes")
      .select("name")
      .eq("share_token", shareToken)
      .single();

    if (noteError || !note) {
      // Return default metadata if note not found
      return {
        title: "Notitie",
        description: "Gedeelde notitie",
        openGraph: {
          title: "Notitie",
          description: "Gedeelde notitie",
          images: [imageUrl],
          url: shareUrl,
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title: "Notitie",
          description: "Gedeelde notitie",
          images: [imageUrl],
        },
      };
    }

    // Return metadata with note name
    return {
      title: note.name || "Notitie",
      description: "Gedeelde notitie",
      openGraph: {
        title: note.name || "Notitie",
        description: "Gedeelde notitie",
        images: [imageUrl],
        url: shareUrl,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: note.name || "Notitie",
        description: "Gedeelde notitie",
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    // Return default metadata on error
    return {
      title: "Notitie",
      description: "Gedeelde notitie",
      openGraph: {
        title: "Notitie",
        description: "Gedeelde notitie",
        images: [imageUrl],
        url: shareUrl,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: "Notitie",
        description: "Gedeelde notitie",
        images: [imageUrl],
      },
    };
  }
}

export default async function SharedNotePage({ params }) {
  const { shareToken } = await params;

  // Fetch note by share_token
  const { data: note, error: noteError } = await supabaseServer
    .from("notes")
    .select("*")
    .eq("share_token", shareToken)
    .single();

  if (noteError || !note) {
    return (
      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4">
          <div className="w-16"></div>
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

  // Fetch items
  const { data: itemsRaw, error: itemsError } = await supabaseServer
    .from("note_items")
    .select("*")
    .eq("note_id", note.id)
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
    <SharedNoteClient
      shareToken={shareToken}
      initialNote={note}
      initialItems={items || []}
    />
  );
}
