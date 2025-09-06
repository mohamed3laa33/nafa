import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function appendNote(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = String(body?.note || '').trim();
  const kind = String(body?.kind || 'note');
  if (!note) return NextResponse.json({ error: 'note required' }, { status: 400 });

  // Visibility: owner or admin can always add; viewers can add if they follow? Keep simple: only admin/analyst owner for now
  const [[row]]: any = await pool.execute(
    "SELECT opened_by_user_id FROM stock_calls WHERE id=? LIMIT 1",
    [id]
  );
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.user.role !== 'admin' && String(row.opened_by_user_id) !== String(req.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await pool.execute(
    "INSERT INTO call_notes (id, call_id, user_id, note, kind) VALUES (UUID(), ?, ?, ?, ?)",
    [id, req.user.id, note, kind === 'system' ? 'note' : kind]
  );
  return new NextResponse(null, { status: 204 });
}

export const POST = withAuth(appendNote, ["admin", "analyst"]);

