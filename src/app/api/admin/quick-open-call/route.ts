import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

const schema = z
  .object({
    ticker: z
      .string()
      .min(1)
      .max(10)
      .transform((s) => s.trim().toUpperCase())
      .refine((s) => /^[A-Z0-9.\-]{1,10}$/.test(s), { message: "Invalid ticker" }),
    entry_price: z.number().refine((n) => Number.isFinite(n) && n > 0, {
      message: "entry_price must be a positive number",
    }),
    target_price: z.number().refine((n) => Number.isFinite(n) && n > 0, {
      message: "target_price must be a positive number",
    }),
    is_public: z.boolean().optional().default(false),
    note: z.string().optional(),
  })
  .refine((o) => o.entry_price !== o.target_price, {
    message: "target_price must differ from entry_price",
    path: ["target_price"],
  });

interface StockIdRow extends RowDataPacket {
  id: string;
}

async function upsertStock(ticker: string, userId: string | number, conn?: any) {
  const t = ticker.toUpperCase().trim();
  const exec = conn?.execute ? conn.execute.bind(conn) : pool.execute.bind(pool);
  const [rows] = await exec<StockIdRow[]>(
    "SELECT id FROM stocks WHERE ticker = ? AND market = 'US' LIMIT 1",
    [t]
  );
  if (rows && rows[0]?.id) return rows[0].id;
  const id = uuidv4();
  await exec(
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
    entry_price: Number(body?.entry_price),
    target_price: Number(body?.target_price),
    is_public: body?.is_public,
    note: body?.note,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  let { ticker, entry_price, target_price, is_public, note } = parsed.data;
  if (typeof note === 'string' && note.length > 1000) note = note.slice(0, 1000);
  const { id: userId } = req.user;

  try {
    const isBuy = target_price >= entry_price;
    const typeVal = isBuy ? 'buy' : 'sell';
    const stop = Number((entry_price * (isBuy ? 0.9 : 1.1)).toFixed(4));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const stockId = await upsertStock(ticker, userId, conn);
      // Duplicate prevention: existing open call by same user for this stock
      const [dups] = await conn.execute<any[]>(
        `SELECT id FROM stock_calls WHERE stock_id = ? AND opened_by_user_id = ? AND status = 'open' LIMIT 1`,
        [stockId, userId]
      );
      if (Array.isArray(dups) && dups.length) {
        await conn.rollback();
        return NextResponse.json({ error: 'Open call already exists for this stock by you', stockId }, { status: 409 });
      }
      const callId = uuidv4();
      try {
        await conn.execute(
          `INSERT INTO stock_calls
             (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, type, is_public)
           VALUES
             (?,  ?,        ?,                ?,     ?,   ?,  NULL, NULL,  30,            'open', NOW(),   ?,    ?,     ?)`,
          [callId, stockId, userId, entry_price, stop, target_price, note ?? null, typeVal, is_public ? 1 : 0]
        );
      } catch (e: any) {
        if (String(e?.code) === 'ER_BAD_FIELD_ERROR' || /unknown column 'type'/i.test(String(e?.message))) {
          await conn.execute(
            `INSERT INTO stock_calls
               (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, is_public)
             VALUES
               (?,  ?,        ?,                ?,     ?,   ?,  NULL, NULL,  30,            'open', NOW(),   ?,    ?)`,
            [callId, stockId, userId, entry_price, stop, target_price, note ?? null, is_public ? 1 : 0]
          );
        } else {
          throw e;
        }
      }
      await conn.execute("UPDATE stocks SET status='active' WHERE id=?", [stockId]);
      await conn.commit();
      return NextResponse.json({ stockId, callId, type: typeVal, stop, requestId: crypto.randomUUID?.() || callId });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      try { conn.release(); } catch {}
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withAuth(handler, ["admin", "analyst"]);
