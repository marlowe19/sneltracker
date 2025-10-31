import { NextResponse } from "next/server";
import { getDb, getAdminDiagnostics } from "@/lib/firebaseAdmin";

export async function GET() {
  const diagnostics = { ok: false, admin: getAdminDiagnostics() };
  try {
    const db = getDb();
    // Minimal read to verify connectivity and permissions
    const snap = await db.collection("time_entries").limit(1).get();
    diagnostics.ok = true;
    diagnostics.firestore = {
      connected: true,
      collection: "time_entries",
      sampleCount: snap.size,
    };
    return NextResponse.json(diagnostics, { status: 200 });
  } catch (e) {
    diagnostics.error = e instanceof Error ? e.message : String(e);
    // Attach basic code if present (grpc-status)
    if (e && typeof e === "object") {
      const anyErr = e;
      diagnostics.code = anyErr.code ?? null;
    }
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
