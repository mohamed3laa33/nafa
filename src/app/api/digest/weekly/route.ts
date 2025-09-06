import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function handler(req: AuthenticatedRequest) {
  const uid = req.user.id;
  try {
    const [[{ since }]]: any = await pool.execute("SELECT DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) AS since");

    // New public calls from followed analysts
    const [newCalls]: any = await pool.execute(
      `SELECT c.id, c.stock_id, s.ticker, c.opened_by_user_id, u.username, c.opened_at, c.entry, c.t1 AS target
       FROM follows f
       JOIN stock_calls c ON c.opened_by_user_id = f.following_id AND c.is_public = 1 AND c.opened_at >= ?
       JOIN stocks s ON s.id = c.stock_id
       LEFT JOIN users u ON u.id = c.opened_by_user_id
       WHERE f.follower_id = ?
       ORDER BY c.opened_at DESC
       LIMIT 200`,
      [since, uid]
    );

    // Recent wins/losses closed in last 7 days
    const [recentClosed]: any = await pool.execute(
      `SELECT c.id, s.ticker, c.opened_by_user_id, u.username, c.outcome, c.result_pct, c.closed_at
       FROM follows f
       JOIN stock_calls c ON c.opened_by_user_id = f.following_id AND c.status = 'closed' AND c.closed_at >= ?
       JOIN stocks s ON s.id = c.stock_id
       LEFT JOIN users u ON u.id = c.opened_by_user_id
       WHERE f.follower_id = ?
       ORDER BY c.result_pct DESC
       LIMIT 200`,
      [since, uid]
    );

    // Top movers proxy: best/worst recentClosed
    const topWinners = recentClosed.slice(0, 5);
    const topLosers = [...recentClosed].sort((a:any,b:any)=>Number(a.result_pct)-Number(b.result_pct)).slice(0,5);

    return NextResponse.json({ since, new_calls: newCalls, recent_closed: recentClosed, top_winners: topWinners, top_losers: topLosers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export const GET = withAuth(handler, ["viewer", "analyst"]);

