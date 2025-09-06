import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const [rows]: any = await pool.execute(
      `SELECT c.id, s.ticker, c.entry, c.t1 AS target, c.result_pct, c.outcome, c.opened_at, c.closed_at, c.status
       FROM stock_calls c JOIN stocks s ON s.id = c.stock_id
       WHERE c.opened_by_user_id = ? AND c.is_public = 1
       ORDER BY c.opened_at DESC LIMIT 100`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

