import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

type Row = { ticker: string; entry: number; target: number };

interface StockIdRow extends RowDataPacket {
  id: string;
}

function parseRows(raw: string): Row[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: Row[] = [];
  for (const l of lines) {
    const parts = l.includes(',') ? l.split(',') : l.split(/\s+/);
    if (parts.length < 3) continue;
    const [t0, e0, tg0] = parts.map(s => String(s).trim());
    const ticker = t0.toUpperCase();
    const entry = Number(e0);
    const target = Number(tg0);
    if (!ticker || !Number.isFinite(entry) || !Number.isFinite(target)) continue;
    out.push({ ticker, entry, target });
  }
  return out;
}

async function upsertStock(ticker: string, userId: string | number) {
  const t = ticker.toUpperCase().trim();
  const [rows] = await pool.execute<StockIdRow[]>("SELECT id FROM stocks WHERE ticker = ? AND market = 'US' LIMIT 1", [t]);
  if (rows && rows[0]?.id) return rows[0].id;
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO stocks (id, ticker, market, name, created_by_user_id, owner_analyst_user_id)`
    `     VALUES (?, ?, 'US', NULL, ?, ?)`,
    [id, t, userId, userId]
  );
  return id;
}

async function handler(req: AuthenticatedRequest) {
  const raw = await req.text().catch(() => "");
  let rows: Row[] = [];
  let isPublic = false;
  if (raw && raw.trim().length && req.headers.get('content-type')?.includes('text/plain')) {
    rows = parseRows(raw);
  } else {
    const j: any = await req.json().catch(() => ({}));
    if (Array.isArray(j)) {
      rows = j.map((r: Row) => ({ ticker: String(r.ticker||'').toUpperCase(), entry: Number(r.entry), target: Number(r.target) }))
               .filter((r: Row) => r.ticker && Number.isFinite(r.entry) && Number.isFinite(r.target));
    } else if (Array.isArray(j?.rows)) {
      rows = j.rows.map((r: Row) => ({ ticker: String(r.ticker||'').toUpperCase(), entry: Number(r.entry), target: Number(r.target) }))
                    .filter((r: Row) => r.ticker && Number.isFinite(r.entry) && Number.isFinite(r.target));
      isPublic = Boolean(j?.is_public);
    }
  }
  if (!rows.length) return NextResponse.json({ error: 'No valid rows provided' }, { status: 400 });

  const { id: userId } = req.user;
  const results: ( { ticker: string; stockId: string; callId: string; } | { ticker: string; error: string; } )[] = [];
  for (const r of rows) {
    try {
      const stockId = await upsertStock(r.ticker, userId);
      const callId = uuidv4();
      const stop = Number((r.entry * 0.9).toFixed(4));
      try {
        await pool.execute(
          `INSERT INTO stock_calls
             (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, type, is_public)
           VALUES
             (?,  ?,        ?,                ?,     ?,   ?,  NULL, NULL,  30,            'open', NOW(),   NULL, 'buy', ?)`,
          [callId, stockId, userId, r.entry, stop, r.target, isPublic ? 1 : 0]
        );
      } catch (e: any) {
        if (String(e?.code) === 'ER_BAD_FIELD_ERROR' || /unknown column 'type'/i.test(String(e?.message))) {
          await pool.execute(
            `INSERT INTO stock_calls
               (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, is_public)
             VALUES
               (?,  ?,        ?,                ?,     ?,   ?,  NULL, NULL,  30,            'open', NOW(),   NULL, ?)`,
            [callId, stockId, userId, r.entry, stop, r.target, isPublic ? 1 : 0]
          );
        } else {
          throw e;
        }
      }
      await pool.execute("UPDATE stocks SET status='active' WHERE id=?", [stockId]);
      results.push({ ticker: r.ticker, stockId, callId });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'failed';
      results.push({ ticker: r.ticker, error: message });
    }
  }
  return NextResponse.json({ inserted: results });
}

export const POST = withAuth(handler, ["admin", "analyst"]);
