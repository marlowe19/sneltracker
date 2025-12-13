import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;
    const { noteId } = await context.params;

    // Fetch note
    const { data: note, error: noteError } = await supabaseServer
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (noteError) {
      console.error("Error fetching note:", noteError);
      return NextResponse.json(
        { error: "Note not found", message: noteError.message },
        { status: 404 }
      );
    }

    // Check access: user must be creator or note must have share_token
    if (note.created_by !== user && !note.share_token) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabaseServer
      .from("note_items")
      .select("*")
      .eq("note_id", noteId)
      .order("position", { ascending: true });

    if (itemsError) {
      console.error("Error fetching note items:", itemsError);
      return NextResponse.json(
        { error: "Failed to fetch note items", message: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      note,
      items: items || [],
    });
  } catch (error) {
    console.error("Error in note detail API:", error);
    return NextResponse.json(
      { error: "Failed to fetch note", message: error.message },
      { status: 500 }
    );
  }
});

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.nickname;
    const { noteId } = await context.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "generate-share-token") {
      // Generate share token for note
      const { data: note, error: noteError } = await supabaseServer
        .from("notes")
        .select("*")
        .eq("id", noteId)
        .eq("created_by", user)
        .single();

      if (noteError || !note) {
        return NextResponse.json(
          { error: "Note not found or access denied" },
          { status: 404 }
        );
      }

      // Generate new UUID for share_token
      // Use crypto.randomUUID() which is available in Node.js 14.17.0+
      const shareToken = crypto.randomUUID();

      // Update note with share_token
      const { data: updatedNote, error: updateError } = await supabaseServer
        .from("notes")
        .update({ share_token: shareToken })
        .eq("id", noteId)
        .select()
        .single();

      if (updateError) {
        console.error("Error generating share token:", updateError);
        return NextResponse.json(
          {
            error: "Failed to generate share token",
            message: updateError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ share_token: shareToken });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in note API POST:", error);
    return NextResponse.json(
      { error: "Failed to process request", message: error.message },
      { status: 500 }
    );
  }
}
