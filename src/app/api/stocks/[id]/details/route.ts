import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

// Allow partials; sentiment limited set; score 0..100 or null
const stockDetailsSchema = z.object({
  technical_json: z.unknown().nullable().optional(),
  fundamental_json: z.unknown().nullable().optional(),
  sentiment: z.enum(["bullish", "bearish", "neutral"]).nullable().optional(),
  score_total: z.number().int().min(0).max(100).nullable().optional(),
});

// helper: if column is JSON/TEXT, pass string; if value is null/undefined, pass null
const serializeJson = (v: unknown) =>
  v === undefined || v === null ? null : JSON.stringify(v);

// GET /api/stocks/[id]/details
async function getStockDetails(
  _req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [rows]: any = await pool.execute(
    `SELECT technical_json, fundamental_json, sentiment, score_total, updated_at, updated_by_user_id
       FROM stock_details
      WHERE stock_id = ?
      LIMIT 1`,
    [id]
  );

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Stock details not found" }, { status: 404 });
  }

  const r = rows[0];
  return NextResponse.json({
    technical_json: r.technical_json ?? null,
    fundamental_json: r.fundamental_json ?? null,
    sentiment: r.sentiment ?? null,
    score_total: r.score_total ?? null,
    updated_at: r.updated_at,
    updated_by_user_id: r.updated_by_user_id,
  });
}

// PUT /api/stocks/[id]/details  (partial upsert)
async function upsertStockDetails(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // UUID
  const { id: userId, role } = req.user;

  // Parse & normalize
  const raw = await req.json().catch(() => ({}));
  // Accept "" for sentiment/score as null (defensive)
  if (raw && typeof raw === "object") {
    if (raw.sentiment === "") raw.sentiment = null;
    if (raw.score_total === "") raw.score_total = null;
  }
  const parsed = stockDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { technical_json, fundamental_json, sentiment, score_total } = parsed.data;

  try {
    // Ownership check for analysts
    const [stockRows]: any = await pool.execute(
      "SELECT owner_analyst_user_id FROM stocks WHERE id = ? LIMIT 1",
      [id]
    );
    const stock = stockRows && stockRows[0];
    if (!stock) return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    if (role === "analyst" && stock.owner_analyst_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Merge with existing for partial updates
    const [curRows]: any = await pool.execute(
      `SELECT technical_json, fundamental_json, sentiment, score_total
         FROM stock_details WHERE stock_id = ? LIMIT 1`,
      [id]
    );
    const cur = curRows && curRows[0] ? curRows[0] : {};

    const merged = {
      technical_json:
        technical_json !== undefined ? technical_json : cur.technical_json ?? null,
      fundamental_json:
        fundamental_json !== undefined ? fundamental_json : cur.fundamental_json ?? null,
      sentiment: sentiment !== undefined ? sentiment : cur.sentiment ?? null,
      score_total: score_total !== undefined ? score_total : cur.score_total ?? null,
    };

    // Upsert
    await pool.execute(
      `INSERT INTO stock_details
         (stock_id, technical_json, fundamental_json, sentiment, score_total, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         technical_json = VALUES(technical_json),
         fundamental_json = VALUES(fundamental_json),
         sentiment = VALUES(sentiment),
         score_total = VALUES(score_total),
         updated_by_user_id = VALUES(updated_by_user_id),
         updated_at = NOW()`,
      [
        id,
        serializeJson(merged.technical_json),
        serializeJson(merged.fundamental_json),
        merged.sentiment, // enum or null
        merged.score_total, // 0..100 or null
        userId,
      ]
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withAuth(getStockDetails);
export const PUT = withAuth(upsertStockDetails, ["admin", "analyst"]);
