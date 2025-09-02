import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function handler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [[userRow]]: any = await pool.execute(
      "SELECT id, COALESCE(name, email) AS name, email, role FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    const analyst = Array.isArray(userRow) ? userRow[0] : userRow;
    if (!analyst) return NextResponse.json({ error: "Analyst not found" }, { status: 404 });

    const [[stats]]: any = await pool.execute(
      `SELECT 
         COUNT(*) AS total_calls,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_calls,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_calls,
         AVG(CASE WHEN status = 'closed' THEN result_pct END) AS avg_return_pct,
         SUM(CASE WHEN status = 'closed' AND (outcome = 'target_hit' OR result_pct >= 0) THEN 1 ELSE 0 END) 
           / NULLIF(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0) AS win_rate
       FROM stock_calls WHERE opened_by_user_id = ?`,
      [id]
    );

    const [portfolio]: any = await pool.execute(
      "SELECT id, ticker, name FROM stocks WHERE owner_analyst_user_id = ? ORDER BY ticker",
      [id]
    );

    const [recentClosed]: any = await pool.execute(
      `SELECT c.id, s.ticker, c.entry, c.t1 AS target, c.result_pct, c.outcome, c.opened_at, c.closed_at
       FROM stock_calls c JOIN stocks s ON s.id = c.stock_id
       WHERE c.opened_by_user_id = ? AND c.status = 'closed'
       ORDER BY c.closed_at DESC LIMIT 50`,
      [id]
    );

    return NextResponse.json({ analyst, stats, portfolio, recent_closed: recentClosed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

