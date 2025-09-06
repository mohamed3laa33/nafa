import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";

interface FollowingRow extends RowDataPacket {
  following_id: string;
}

async function getCalls(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status");
    const rawOutcome = searchParams.get("outcome");
    const rawTicker = searchParams.get("ticker");
    const analyst = searchParams.get("analyst");
    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");
    const rawLimit = searchParams.get("limit");
    const cursorOpenedAt = searchParams.get("cursor_opened_at");
    const cursorId = searchParams.get("cursor_id");

    const status = rawStatus ? rawStatus.toLowerCase() : undefined;
    const outcome = rawOutcome ? rawOutcome.toLowerCase() : undefined;
    const ticker = rawTicker ? rawTicker.toUpperCase() : undefined;

    const okStatus = !status || ["open", "closed"].includes(status);
    const okOutcome = !outcome || ["target_hit", "stop_hit", "expired", "cancelled"].includes(outcome);
    if (!okStatus || !okOutcome) {
      return NextResponse.json({ error: "Invalid status or outcome" }, { status: 400 });
    }

    function parseDateTime(s?: string | null): string | null {
      if (!s) return null;
      const d = new Date(s);
      if (isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, "0");
      const yy = d.getUTCFullYear();
      const mm = pad(d.getUTCMonth() + 1);
      const dd = pad(d.getUTCDate());
      const hh = pad(d.getUTCHours());
      const mi = pad(d.getUTCMinutes());
      const ss = pad(d.getUTCSeconds());
      return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    }

    const from = parseDateTime(rawFrom);
    const to = parseDateTime(rawTo);
    if ((rawFrom && !from) || (rawTo && !to)) {
      return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
    }

    const limit = Math.min(100, Math.max(1, Number(rawLimit || 5)));

    // Build base FROM and WHERE
    let base =
      "FROM stock_calls c JOIN stocks s ON c.stock_id = s.id LEFT JOIN users u ON u.id = c.opened_by_user_id";
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    // Role-based visibility
    if (req.user.role === "analyst") {
      whereClauses.push("c.opened_by_user_id = ?");
      params.push(req.user.id);
    } else if (req.user.role === "viewer") {
      // Use JOIN rather than IN list to leverage composite index
      base += " LEFT JOIN follows f ON f.follower_id = ? AND f.following_id = c.opened_by_user_id";
      params.push(req.user.id);
      whereClauses.push("(f.following_id IS NOT NULL OR c.is_public = 1)");
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

    // Keyset pagination guard
    if (cursorOpenedAt && cursorId) {
      whereClauses.push("(c.opened_at < ? OR (c.opened_at = ? AND c.id < ?))");
      params.push(cursorOpenedAt, cursorOpenedAt, cursorId);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sql = `
      SELECT
        c.id,
        c.stock_id,
        c.opened_by_user_id,
        c.entry,
        c.stop,
        c.t1,
        c.t2,
        c.t3,
        c.horizon_days,
        c.opened_at,
        c.expires_at,
        c.status,
        c.outcome,
        c.which_target_hit,
        c.closed_at,
        c.close_price,
        c.result_pct,
        c.notes AS note,
        c.is_public,
        s.ticker,
        u.id AS opened_by_id,
        COALESCE(u.username, u.email) AS opened_by
      ${base}
      ${whereSql}
      ORDER BY c.opened_at DESC, c.id DESC
      LIMIT ?
    `;

    const cacheKey = JSON.stringify({
      u: req.user.id,
      r: req.user.role,
      status,
      outcome,
      ticker,
      analyst,
      from,
      to,
      cursorOpenedAt,
      cursorId,
      limit,
    });

    const run = unstable_cache(
      async () => {
        const [rows] = await pool.execute(sql, [...params, limit]);
        // @ts-ignore
        return rows as any[];
      },
      ["calls", cacheKey],
      { revalidate: 10 }
    );

    const rows: any[] = await run();

    // Compute cache validators
    const latestOpenedAt: string | undefined = rows?.[0]?.opened_at ? new Date(rows[0].opened_at).toUTCString() : undefined;
    const etag = latestOpenedAt ? `W/\"calls:${status || "*"}:${ticker || "*"}:${latestOpenedAt}:${rows.length}\"` : undefined;

    const inm = req.headers.get("if-none-match");
    const ims = req.headers.get("if-modified-since");
    if (etag && inm === etag) {
      const res304 = new NextResponse(null, { status: 304 });
      res304.headers.set("ETag", etag);
      if (latestOpenedAt) res304.headers.set("Last-Modified", latestOpenedAt);
      return res304;
    }
    if (latestOpenedAt && ims && new Date(ims).getTime() >= new Date(latestOpenedAt).getTime()) {
      const res304 = new NextResponse(null, { status: 304 });
      if (etag) res304.headers.set("ETag", etag);
      res304.headers.set("Last-Modified", latestOpenedAt);
      return res304;
    }

    const next = rows.length === limit
      ? { cursor_opened_at: rows[rows.length - 1].opened_at, cursor_id: rows[rows.length - 1].id }
      : null;

    const resp = NextResponse.json({ data: rows, next });
    if (etag) resp.headers.set("ETag", etag);
    if (latestOpenedAt) resp.headers.set("Last-Modified", latestOpenedAt);
    resp.headers.set("Cache-Control", "public, max-age=10");
    return resp;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export const GET = withAuth(getCalls);
