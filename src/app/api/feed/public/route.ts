import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sector = (searchParams.get('sector') || '').trim() || null;
    const tags = (searchParams.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean);
    const status = (searchParams.get('status') || 'open').toLowerCase();
    const days = Math.min(365, Math.max(1, Number(searchParams.get('days') || 30)));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const cursorOpenedAt = searchParams.get('cursor_opened_at');
    const cursorId = searchParams.get('cursor_id');

    const where: string[] = ["c.is_public = 1"]; const params: any[] = [];
    if (status === 'open') where.push("c.status = 'open'");
    else if (status === 'closed') where.push("c.status = 'closed'");
    else if (status !== 'all') return NextResponse.json({ error: 'invalid status' }, { status: 400 });

    where.push("c.opened_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)");
    params.push(days);

    if (sector) { where.push("s.sector = ?"); params.push(sector); }
    if (tags.length) { where.push(`JSON_OVERLAPS(c.rationale, ?) `); params.push(JSON.stringify(tags)); }
    if (cursorOpenedAt && cursorId) {
      where.push("(c.opened_at < ? OR (c.opened_at = ? AND c.id < ?))");
      params.push(cursorOpenedAt, cursorOpenedAt, cursorId);
    }

    const sql = `
      SELECT c.id, c.stock_id, s.ticker, s.sector, c.opened_by_user_id,
             c.entry, c.t1, c.stop, c.opened_at, c.status, c.outcome,
             c.result_pct, c.rationale, c.confidence
      FROM stock_calls c
      JOIN stocks s ON s.id = c.stock_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.opened_at DESC, c.id DESC
      LIMIT ?`;

    const cacheKey = JSON.stringify({ sector, tags, status, days, limit, cursorOpenedAt, cursorId });
    const run = unstable_cache(
      async () => {
        const [rows]: any = await pool.execute(sql, [...params, limit]);
        return rows;
      },
      ["public-feed", cacheKey],
      { revalidate: 15 }
    );

    const rows: any[] = await run();
    const next = rows.length === limit ? { cursor_opened_at: rows[rows.length - 1].opened_at, cursor_id: rows[rows.length - 1].id } : null;
    return NextResponse.json({ data: rows, next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

