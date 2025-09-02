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
    "SELECT opened_by_user_id FROM stock_calls WHERE id = ? LIMIT 1",
    [id]
  );
  if (!rows || !rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.user.role !== 'admin' && String(rows[0].opened_by_user_id) !== String(req.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await pool.execute("UPDATE stock_calls SET is_public = ? WHERE id = ?", [isPublic ? 1 : 0, id]);
  return NextResponse.json({ id, is_public: isPublic });
}

export const PUT = withAuth(updatePublic, ["admin", "analyst"]);

