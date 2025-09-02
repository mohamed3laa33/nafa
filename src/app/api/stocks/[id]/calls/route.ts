import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

/** GET /api/stocks/[id]/calls — list calls for a stock */
async function getCalls(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> } // Next 15: params is async
) {
  const { id } = await params; // UUID
  const stockId = id;

  let sql = `SELECT
       id,
        stock_id,
        opened_by_user_id,
       entry        AS entry_price,
       stop         AS stop_loss,
       t1           AS target_price,
       t2,
       t3,
       horizon_days,
       opened_at,
       expires_at,
       status,
       outcome,
       which_target_hit,
       closed_at,
       close_price,
       result_pct,
       notes        AS note,
       is_public
     FROM stock_calls
     WHERE stock_id = ?`;
  const sqlParams: any[] = [stockId];

  if (req.user.role === 'viewer') {
    sql += ` AND opened_by_user_id IN (
      SELECT following_id FROM follows WHERE follower_id = ?
    )`;
    sqlParams.push(req.user.id);
  }

  sql += ` ORDER BY opened_at DESC`;

  const [rows] = await pool.execute(sql, sqlParams);

  // @ts-ignore
  return NextResponse.json({ data: rows || [] });
}

/** POST /api/stocks/[id]/calls — open a new call
 * Accepts either:
 *  - Legacy: { entry, stop, t1?, t2?, t3?, horizon_days, note? }
 *  - New   : { type?, entry_price, target_price?, stop_loss?, note? }
 */
const legacyOpenSchema = z.object({
  entry: z.number().positive(),
  stop: z.number().positive(),
  t1: z.number().positive().nullable().optional(),
  t2: z.number().positive().nullable().optional(),
  t3: z.number().positive().nullable().optional(),
  horizon_days: z.number().int().positive().default(30),
  note: z.string().optional(),
});

const newOpenSchema = z.object({
  type: z.enum(["buy", "sell"]).optional(),
  entry_price: z.number().positive(),
  target_price: z.number().positive().nullable().optional(),
  stop_loss: z.number().positive().nullable().optional(),
  is_public: z.boolean().optional().default(false),
  note: z.string().optional(),
});

// Fundamental call (no entry/target required)
const fundamentalOpenSchema = z.object({
  type: z.enum(["buy", "sell"]),
  is_public: z.boolean().optional().default(false),
  note: z.string().optional(),
});

async function openCall(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // UUID
  const stockId = id;
  const { id: userId } = req.user;

  const body = await req.json();

  // Try new shape first; if invalid, try legacy
  const newParsed = newOpenSchema.safeParse(body);
  const legacyParsed = newParsed.success ? null : legacyOpenSchema.safeParse(body);
  const fundamentalParsed = newParsed.success || legacyParsed?.success ? null : fundamentalOpenSchema.safeParse(body);

  if (!newParsed.success && !legacyParsed?.success && !fundamentalParsed?.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Map to DB columns
  let entry: number = 0;
  let stop: number = 0;
  let t1: number | null = null;
  let t2: number | null = null;
  let t3: number | null = null;
  let horizon_days = 30;
  let notes: string | null = null;
  let callType: "buy" | "sell" | null = null;
  let is_public = false;

  if (newParsed.success) {
    entry = newParsed.data.entry_price;
    stop = newParsed.data.stop_loss ?? 0;
    t1 = newParsed.data.target_price ?? null;
    notes = newParsed.data.note ?? null;
    callType = newParsed.data.type ?? null;
    is_public = newParsed.data.is_public ?? false;

    if (!stop) {
      return NextResponse.json({ error: "stop_loss is required" }, { status: 400 });
    }
  } else if (legacyParsed?.success) {
    entry = legacyParsed!.data.entry;
    stop = legacyParsed!.data.stop;
    t1 = legacyParsed!.data.t1 ?? null;
    t2 = legacyParsed!.data.t2 ?? null;
    t3 = legacyParsed!.data.t3 ?? null;
    horizon_days = legacyParsed!.data.horizon_days ?? 30;
    notes = legacyParsed!.data.note ?? null;
  } else if (fundamentalParsed?.success) {
    // Fundamental: no entry/stop required
    callType = fundamentalParsed.data.type;
    is_public = fundamentalParsed.data.is_public ?? false;
    notes = fundamentalParsed.data.note ?? null;
    // leave entry=0, stop=0, t1=null
  }

  const callId = uuidv4();

  // Insert with fallback if `type` column does not exist
  try {
    await pool.execute(
      `INSERT INTO stock_calls
         (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, type, is_public)
       VALUES
         (?,  ?,        ?,                ?,     ?,   ?,  ?,  ?,  ?,             'open', NOW(),   ?,    ?,    ?)`,
      [callId, stockId, userId, entry, stop, t1, t2, t3, horizon_days, notes, callType, is_public]
    );
  } catch (e: any) {
    // Retry without `type` if column missing
    if (String(e?.code) === 'ER_BAD_FIELD_ERROR' || /unknown column 'type'/i.test(String(e?.message))) {
      await pool.execute(
        `INSERT INTO stock_calls
           (id, stock_id, opened_by_user_id, entry, stop, t1, t2, t3, horizon_days, status, opened_at, notes, is_public)
         VALUES
           (?,  ?,        ?,                ?,     ?,   ?,  ?,  ?,  ?,             'open', NOW(),   ?,    ?)`,
        [callId, stockId, userId, entry, stop, t1, t2, t3, horizon_days, notes, is_public]
      );
    } else {
      throw e;
    }
  }
  await pool.execute(
  "UPDATE stocks SET status = 'active' WHERE id = ?",
  [stockId]
);

  return NextResponse.json({ id: callId }, { status: 201 });
}

export const GET = withAuth(getCalls);
export const POST = withAuth(openCall, ["admin", "analyst"]);
