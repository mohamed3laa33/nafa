import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function handler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let userRowData: any;
    try {
      const [[row]]: any = await pool.execute(
        "SELECT id, COALESCE(username, email) AS name, email, role FROM users WHERE id = ? LIMIT 1",
        [id]
      );
      userRowData = row;
    } catch {
      const [[row]]: any = await pool.execute(
        "SELECT id, email AS name, email, role FROM users WHERE id = ? LIMIT 1",
        [id]
      );
      userRowData = row;
    }
    const analyst = Array.isArray(userRowData) ? userRowData[0] : userRowData;
    if (!analyst) return NextResponse.json({ error: "Analyst not found" }, { status: 404 });

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
      [id]
    );

    // Last 3 closed for streak
    const [lastClosed]: any = await pool.execute(
      `SELECT result_pct FROM stock_calls WHERE opened_by_user_id = ? AND status = 'closed' ORDER BY closed_at DESC LIMIT 3`,
      [id]
    );
    const hotStreak = lastClosed.length === 3 && lastClosed.every((r: any) => Number(r.result_pct) >= 0);

    // Average time to close in days
    const [[timing]]: any = await pool.execute(
      `SELECT AVG(TIMESTAMPDIFF(DAY, opened_at, closed_at)) AS avg_days_to_close
       FROM stock_calls WHERE opened_by_user_id = ? AND status = 'closed' AND closed_at IS NOT NULL`,
      [id]
    );

    const badges: string[] = [];
    const closed = Number(stats?.closed_calls || 0);
    const winRate = Number(stats?.win_rate || 0);
    const avgConf = Number(stats?.avg_confidence || 0);
    if (closed >= 20 && winRate >= 0.6) badges.push('Consistent Winner');
    if (hotStreak) badges.push('Hot Streak');
    if (avgConf >= 70 && closed >= 10) badges.push('High Conviction');
    if (Number(timing?.avg_days_to_close || 0) > 0 && Number(timing?.avg_days_to_close) <= 14) badges.push('Quick Closer');

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

    return NextResponse.json({ analyst, stats: { ...stats, avg_days_to_close: timing?.avg_days_to_close ?? null }, badges, portfolio, recent_closed: recentClosed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
