
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function getCalls(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const outcome = searchParams.get("outcome");
  const ticker = searchParams.get("ticker");
  const analyst = searchParams.get("analyst");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = "SELECT c.*, s.ticker FROM stock_calls c JOIN stocks s ON c.stock_id = s.id";
  const whereClauses = [];
  const params = [];

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
