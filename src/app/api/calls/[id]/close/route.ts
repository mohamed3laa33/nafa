import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const closeCallSchema = z.object({
  outcome: z.enum(["target_hit", "stop_hit", "expired", "cancelled"]),
  which_target_hit: z.number().int().min(1).max(3).optional(),
  // Optional extras if you want to pass them explicitly
  close_price: z.number().positive().optional(),
  result_pct: z.number().optional(),
  note: z.string().optional(),
});

async function closeCall(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> } // Next 15: params is async
) {
  const { id } = await params;     // UUID
  const callId = id;
  const { id: userId, role } = req.user;

  const body = await req.json();
  const parsed = closeCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { outcome, which_target_hit, close_price: bodyClosePrice, result_pct: bodyResultPct, note } = parsed.data;

  try {
    // Load the call and ensure it is open
    const [callRows] = await pool.execute(
      "SELECT opened_by_user_id, status, entry, stop, t1, t2, t3 FROM stock_calls WHERE id = ? LIMIT 1",
      [callId]
    );
    // @ts-ignore
    const call = callRows && callRows[0];

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }
    if (call.status !== "open") {
      return NextResponse.json({ error: "Call is already closed" }, { status: 409 });
    }

    // Analysts may only close their own calls
    if (role === "analyst" && call.opened_by_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Derive close_price/result_pct if not explicitly provided
    let finalClosePrice: number | null = bodyClosePrice ?? null;
    let finalResultPct: number | null = bodyResultPct ?? null;

    if (finalClosePrice == null || finalResultPct == null) {
      if (outcome === "target_hit") {
        if (!which_target_hit || which_target_hit < 1 || which_target_hit > 3) {
          return NextResponse.json({ error: "which_target_hit (1-3) is required for target_hit" }, { status: 400 });
        }
        const tCol = `t${which_target_hit}` as "t1" | "t2" | "t3";
        const price = call[tCol];
        if (!price) {
          return NextResponse.json({ error: `Target ${which_target_hit} price is not set` }, { status: 400 });
        }
        finalClosePrice = Number(price);
        finalResultPct = Number(((finalClosePrice - Number(call.entry)) / Number(call.entry)) * 100);
      } else if (outcome === "stop_hit") {
        finalClosePrice = Number(call.stop);
        finalResultPct = Number(((finalClosePrice - Number(call.entry)) / Number(call.entry)) * 100);
      } else {
        // expired / cancelled → no price/profit by default unless provided
        finalClosePrice ??= null;
        finalResultPct ??= null;
      }
    }

    await pool.execute(
      `UPDATE stock_calls
         SET status = 'closed',
             outcome = ?,
             which_target_hit = ?,
             close_price = ?,
             result_pct = ?,
             closed_at = NOW(),
             closed_by_user_id = ?,
             notes = COALESCE(?, notes)
       WHERE id = ?`,

      [
        outcome,
        which_target_hit ?? null,
        finalClosePrice,
        finalResultPct,
        userId,
        note ?? null,
        callId,
      ]
    );
    await pool.execute(
      `UPDATE stocks s
        JOIN stock_calls c0 ON c0.id = ?
        SET s.status = CASE
                          WHEN EXISTS (
                            SELECT 1
                              FROM stock_calls c
                            WHERE c.stock_id = c0.stock_id
                              AND c.status = 'open'
                          )
                          THEN 'active'
                          ELSE 'archived'
                        END
      WHERE s.id = c0.stock_id`,
      [callId]
    );    
// Recompute parent stock status: active if any open calls remain, else archived
    await pool.execute(
      `UPDATE stocks s
        JOIN stock_calls c0 ON c0.id = ?
        SET s.status = CASE
                          WHEN EXISTS (
                            SELECT 1
                              FROM stock_calls c
                            WHERE c.stock_id = c0.stock_id
                              AND c.status = 'open'
                          )
                          THEN 'active'
                          ELSE 'archived'
                        END
      WHERE s.id = c0.stock_id`,
      [callId]
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PATCH = withAuth(closeCall, ["admin", "analyst"]);
export const PUT = withAuth(closeCall, ["admin", "analyst"]);
