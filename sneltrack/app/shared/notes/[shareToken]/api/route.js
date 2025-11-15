import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req, context) {
  try {
    const { shareToken } = await context.params;

    // Fetch note by share_token
    const { data: note, error: noteError } = await supabaseServer
      .from("notes")
      .select("*")
      .eq("share_token", shareToken)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabaseServer
      .from("note_items")
      .select("*")
      .eq("note_id", note.id)
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
    console.error("Error in shared note API:", error);
    return NextResponse.json(
      { error: "Failed to fetch note", message: error.message },
      { status: 500 }
    );
  }
}

