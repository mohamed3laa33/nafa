import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function updatePublic(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const isPublic = Boolean(body?.is_public);

  // Only admin or the call owner can toggle
  const [rows]: any = await pool.execute(
    "SELECT opened_by_user_id, is_public, publish_at FROM stock_calls WHERE id = ? LIMIT 1",
    [id]
  );
  if (!rows || !rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.user.role !== 'admin' && String(rows[0].opened_by_user_id) !== String(req.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Enforce immutability after publish: cannot unpublish once public
  const wasPublic: boolean = rows[0].is_public === 1 || rows[0].is_public === true;
  if (wasPublic && !isPublic) {
    return NextResponse.json({ error: "Published calls cannot be made private" }, { status: 409 });
  }

  if (!wasPublic && isPublic) {
    await pool.execute("UPDATE stock_calls SET is_public = 1, publish_at = NOW() WHERE id = ?", [id]);
    // Audit note
    try {
      await pool.execute(
        "INSERT INTO call_notes (id, call_id, user_id, note, kind) VALUES (UUID(), ?, ?, ?, 'system')",
        [id, req.user.id, 'Call published']
      );
    } catch {}
  }

  return NextResponse.json({ id, is_public: wasPublic || isPublic, publish_at: wasPublic ? rows[0].publish_at : new Date().toISOString() });
}

export const PUT = withAuth(updatePublic, ["admin", "analyst"]);
