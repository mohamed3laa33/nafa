import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

interface FollowingRow extends RowDataPacket {
  following_id: string;
}

async function getCalls(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const outcome = searchParams.get("outcome");
  const ticker = searchParams.get("ticker");
  const analyst = searchParams.get("analyst");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = "SELECT c.*, s.ticker FROM stock_calls c JOIN stocks s ON c.stock_id = s.id";
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
    if (followingIds.length > 0) {
      const placeholders = followingIds.map(() => "?").join(",");
      whereClauses.push(`c.opened_by_user_id IN (${placeholders})`);
      // expand array into params for mysql2 execute
      (params as any[]).push(...followingIds);
    } else {
      // Return no calls if the user is not following anyone
      return NextResponse.json([]);
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

  const [rows] = await pool.execute(query, params);

  return NextResponse.json(rows);
}

export const GET = withAuth(getCalls);
