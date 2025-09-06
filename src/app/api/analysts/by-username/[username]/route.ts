import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await ctx.params;
    const [[user]]: any = await pool.execute(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Reuse existing analyst endpoint data by duplicating logic here for simplicity
    const uid = user.id;
    const [[analyst]]: any = await pool.execute(
      "SELECT id, COALESCE(username, email) AS name, email, role FROM users WHERE id = ? LIMIT 1",
      [uid]
    );
    const [[stats]]: any = await pool.execute(
      `SELECT 
         COUNT(*) AS total_calls,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_calls,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_calls,
         AVG(CASE WHEN status = 'closed' THEN result_pct END) AS avg_return_pct,
         SUM(CASE WHEN status = 'closed' AND (outcome = 'target_hit' OR result_pct >= 0) THEN 1 ELSE 0 END) 
           / NULLIF(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0) AS win_rate,
         AVG(CASE WHEN status = 'closed' THEN confidence END) AS avg_confidence
       FROM stock_calls WHERE opened_by_user_id = ?`,
      [uid]
    );
    const [recentPublic]: any = await pool.execute(
      `SELECT c.id, c.stock_id, s.ticker, c.entry, c.t1 AS target, c.result_pct, c.outcome, c.opened_at, c.closed_at, c.status
       FROM stock_calls c JOIN stocks s ON s.id = c.stock_id
       WHERE c.opened_by_user_id = ? AND c.is_public = 1
       ORDER BY c.opened_at DESC LIMIT 50`,
      [uid]
    );
    return NextResponse.json({ analyst, stats, recent_public: recentPublic });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
