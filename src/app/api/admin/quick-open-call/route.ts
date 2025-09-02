import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

const schema = z.object({
  ticker: z.string().min(1).max(10),
  entry_price: z.number().positive(),
  target_price: z.number().positive(),
  is_public: z.boolean().optional().default(false),
});

interface StockIdRow extends RowDataPacket {
  id: string;
}

async function upsertStock(ticker: string, userId: string | number) {
  const t = ticker.toUpperCase().trim();
  const [rows] = await pool.execute<StockIdRow[]>(
    "SELECT id FROM stocks WHERE ticker = ? AND market = 'US' LIMIT 1",
    [t]
  );
  if (rows && rows[0]?.id) return rows[0].id;
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO stocks (id, ticker, market, name, created_by_user_id, owner_analyst_user_id)
     VALUES (?, ?, 'US', NULL, ?, ?)`,
    [id, t, userId, userId]
  );
  return id;
}

async function handler(req: AuthenticatedRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse({
    ticker: body?.ticker,
    entry_price: typeof body?.entry_price === 'string' ? Number(body.entry_price) : body?.entry_price,
    target_price: typeof body?.target_price === 'string' ? Number(body.target_price) : body?.target_price,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { ticker, entry_price, target_price, is_public } = parsed.data;
  const { id: userId } = req.user;

  try {
    const stockId = await upsertStock(ticker, userId);
    const callId = uuidv4();
    const stop = Number((entry_price * 0.9).toFixed(4)); // default 10% below entry
    try {
      await pool.execute(
        `INSERT INTO stock_calls
           (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, type, is_public)
         VALUES
           (?,  ?,        ?,                ?,     ?,   ?,  NULL, NULL,  30,            'open', NOW(),   NULL, 'buy', ?)`,
        [callId, stockId, userId, entry_price, stop, target_price, is_public ? 1 : 0]
      );
    } catch (e: any) {
      if (String(e?.code) === 'ER_BAD_FIELD_ERROR' || /unknown column 'type'/i.test(String(e?.message))) {
        await pool.execute(
          `INSERT INTO stock_calls
             (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, is_public)
           VALUES
             (?,  ?,        ?,                ?,     ?,   ?,  NULL, NULL,  30,            'open', NOW(),   NULL, ?)`,
          [callId, stockId, userId, entry_price, stop, target_price, is_public ? 1 : 0]
        );
      } else {
        throw e;
      }
    }
    await pool.execute("UPDATE stocks SET status='active' WHERE id=?", [stockId]);
    return NextResponse.json({ stockId, callId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withAuth(handler, ["admin", "analyst"]);
