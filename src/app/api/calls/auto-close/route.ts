import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OpenCallRow = {
  id: string;
  stock_id: string;
  ticker: string;
  entry: number | null;
  t1: number | null;
  type?: string | null;
};

function makeBase(req: Request) {
  const h = req.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function fetchJSON(req: Request, url: string) {
  const abs = url.startsWith('http') ? url : `${makeBase(req)}${url}`;
  const r = await fetch(abs, { cache: 'no-store' }).catch(() => null as any);
  if (!r || !r.ok) return null;
  return r.json().catch(() => null);
}

async function handler(req: AuthenticatedRequest) {
  try {
    // Fetch open calls that have a primary target
    const [rows] = await pool.query(
      `SELECT c.id, c.stock_id, s.ticker, c.entry, c.t1, c.type
         FROM stock_calls c
         JOIN stocks s ON s.id = c.stock_id
        WHERE c.status = 'open' AND c.t1 IS NOT NULL`
    );
    const list: OpenCallRow[] = Array.isArray(rows) ? (rows as any) : [];
    const closed: any[] = [];

    for (const c of list) {
      if (!c?.ticker) continue;
      const j = await fetchJSON(req, `/api/price/${encodeURIComponent(c.ticker)}`);
      const px = j && typeof j.price === 'number' ? j.price : null;
      if (px == null) continue;
      const entry = typeof c.entry === 'number' ? c.entry : Number(c.entry);
      const target = typeof c.t1 === 'number' ? c.t1 : Number(c.t1);
      if (!Number.isFinite(entry) || !Number.isFinite(target)) continue;

      // Determine direction (default long if type missing)
      const isShort = String(c.type || '').toLowerCase() === 'sell';
      const hit = isShort ? (px <= target) : (px >= target);
      if (!hit) continue;

      const resultPct = isShort
        ? ((entry - px) / entry) * 100
        : ((px - entry) / entry) * 100;

      await pool.execute(
        `UPDATE stock_calls
            SET status='closed', outcome='target_hit', which_target_hit=1,
                closed_at=NOW(), close_price=?, result_pct=?
          WHERE id = ?
          LIMIT 1`,
        [px, resultPct, c.id]
      );

      closed.push({ id: c.id, ticker: c.ticker, close_price: px, result_pct: resultPct });
    }

    return NextResponse.json({ closedCount: closed.length, closed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

// Admin-only to avoid accidental mass closures
export const POST = withAuth(handler, ["admin"]);

