import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Returns the latest open call per stock (distinct by stock_id), paginated.
 * Query params:
 * - ticker: optional exact ticker filter (e.g., AAPL)
 * - page: 1-based page number (default 1)
 * - limit: page size (default 5, max 50)
 * Note: Sorting is by opened_at DESC. Any momentum/idea ranking is computed on the client for the current 5 rows.
 */
async function getUniqueOpenCalls(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker");
    const pageParam = Number(searchParams.get("page") || 1);
    const limitParam = Number(searchParams.get("limit") || 5);

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limitBase = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 5;
    const limit = Math.min(50, Math.max(1, limitBase));
    const overfetch = Math.min(51, limit + 1); // fetch +1 to determine hasMore
    const offset = (page - 1) * limit;

    // Role-based visibility
    const role = req.user.role;
    const userId = req.user.id;

    // Build dynamic WHERE
    const where: string[] = ["c.status = 'open'"]; // only open calls
    const params: any[] = [];

    if (role === "analyst") {
      where.push("c.opened_by_user_id = ?");
      params.push(userId);
    } else if (role === "viewer") {
      // viewers see public OR from followed analysts
      where.push(
        "(c.is_public = 1 OR c.opened_by_user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))"
      );
      params.push(userId);
    }

    if (ticker) {
      where.push("s.ticker = ?");
      params.push(ticker);
    }

    // Sorting
    const orderBy = 'x.opened_at DESC';

    // Use window function to pick latest call per stock
    // Note: requires MySQL 8+
    const sql = `
      SELECT * FROM (
        SELECT
          c.*, s.ticker,
          u.id AS opened_by_id,
          COALESCE(u.username, u.email) AS opened_by,
          ROW_NUMBER() OVER (PARTITION BY c.stock_id ORDER BY c.opened_at DESC, c.id DESC) AS rn
        FROM stock_calls c
        JOIN stocks s ON s.id = c.stock_id
        LEFT JOIN users u ON u.id = c.opened_by_user_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ) x
      WHERE x.rn = 1
      ORDER BY ${orderBy}
      LIMIT ${overfetch} OFFSET ${offset}
    `;

    const [rows] = await pool.execute(sql, params);
    const list = Array.isArray(rows) ? (rows as any[]) : [];
    const hasMore = list.length > limit;
    const items = hasMore ? list.slice(0, limit) : list;

    return NextResponse.json({ items, hasMore, page, limit });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export const GET = withAuth(getUniqueOpenCalls);
