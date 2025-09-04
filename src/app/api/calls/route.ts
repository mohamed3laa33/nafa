import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

interface FollowingRow extends RowDataPacket {
  following_id: string;
}

async function getCalls(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const outcome = searchParams.get("outcome");
    const ticker = searchParams.get("ticker");
    const analyst = searchParams.get("analyst");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limitParam = Number(searchParams.get("limit") || 0);
    const pageParam = Number(searchParams.get("page") || 0);

    let query =
      "SELECT c.*, s.ticker, u.id AS opened_by_id, COALESCE(u.username, u.email) AS opened_by FROM stock_calls c JOIN stocks s ON c.stock_id = s.id LEFT JOIN users u ON u.id = c.opened_by_user_id";
    const whereClauses: string[] = [];
    const params: (string | number | (string | number)[])[] = [];

    if (req.user.role === "analyst") {
    whereClauses.push("c.opened_by_user_id = ?");
    params.push(req.user.id);
    } else if (req.user.role === "viewer") {
    const [rows] = await pool.execute<FollowingRow[]>(
      "SELECT following_id FROM follows WHERE follower_id = ?",
      [req.user.id]
    );
    const followingIds = rows.map((row) => String(row.following_id));
    const placeholders = followingIds.map(() => "?").join(",");
    if (followingIds.length > 0) {
      whereClauses.push(`(c.opened_by_user_id IN (${placeholders}) OR c.is_public = 1)`);
      (params as any[]).push(...followingIds);
    } else {
      // If not following anyone, show public calls only
      whereClauses.push("c.is_public = 1");
    }
    }

    if (status) {
    whereClauses.push("c.status = ?");
    params.push(status);
    }

    if (outcome) {
    whereClauses.push("c.outcome = ?");
    params.push(outcome);
    }

    if (ticker) {
    whereClauses.push("s.ticker = ?");
    params.push(ticker);
    }

    if (analyst) {
    whereClauses.push("c.opened_by_user_id = ?");
    params.push(analyst);
    }

    if (from) {
    whereClauses.push("c.opened_at >= ?");
    params.push(from);
    }

    if (to) {
    whereClauses.push("c.opened_at <= ?");
    params.push(to);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    // Order + pagination
    query += " ORDER BY c.opened_at DESC";
    if (limitParam && pageParam) {
      const limit = Math.min(100, Math.max(1, limitParam));
      const page = Math.max(1, pageParam);
      const offset = (page - 1) * limit;
      query += ` LIMIT ${limit} OFFSET ${offset}`; // inline to avoid MySQL param issue
    }

    const [rows] = await pool.execute(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export const GET = withAuth(getCalls);
