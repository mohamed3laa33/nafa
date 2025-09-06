// src/app/api/stocks/[id]/route.ts
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

// GET /api/stocks/[id]
async function getStock(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;       // UUID string
  const stockId = id;

  const [stockRows] = await pool.execute(
    `SELECT s.*, sd.technical_json, sd.fundamental_json, sd.sentiment, sd.score_total
       FROM stocks s
       LEFT JOIN stock_details sd ON s.id = sd.stock_id
      WHERE s.id = ?`,
    [stockId]
  );

  // @ts-ignore
  if (!stockRows || stockRows.length === 0) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  let callRows: any[] = [];
  if (req.user.role === 'viewer') {
    const [rows]: any = await pool.execute(
      `SELECT c.*, u.id AS opened_by_id, COALESCE(u.username, u.email) AS opened_by
         FROM stock_calls c
         LEFT JOIN users u ON u.id = c.opened_by_user_id
        WHERE c.stock_id = ?
          AND c.status = 'open'
          AND c.opened_by_user_id IN (
            SELECT f.following_id FROM follows f WHERE f.follower_id = ?
          )
        ORDER BY c.opened_at DESC, c.id DESC
        LIMIT 1`,
      [stockId, req.user.id]
    );
    callRows = rows as any[];
  } else {
    const [rows]: any = await pool.execute(
      `SELECT c.*, u.id AS opened_by_id, COALESCE(u.username, u.email) AS opened_by
         FROM stock_calls c
         LEFT JOIN users u ON u.id = c.opened_by_user_id
        WHERE c.stock_id = ? AND c.status = 'open'
        ORDER BY c.opened_at DESC, c.id DESC
        LIMIT 1`,
      [stockId]
    );
    callRows = rows as any[];
  }

  // @ts-ignore
  const stock = stockRows[0];
  // @ts-ignore
  const latestOpenCall = (callRows && callRows[0]) || null;

  return NextResponse.json({ ...stock, latestOpenCall });
}

// Align with DB enum: ('active','archived')
const updateStockSchema = z.object({
  name: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

// PUT /api/stocks/[id]
async function updateStock(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stockId = id;
  const { id: userId, role } = req.user;

  const body = await req.json();
  const parsed = updateStockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, status } = parsed.data;
  if (!name && !status) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const [stockRows] = await pool.execute(
      "SELECT owner_analyst_user_id FROM stocks WHERE id = ?",
      [stockId]
    );
    // @ts-ignore
    const stock = stockRows && stockRows[0];
    if (!stock) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    if (role === "analyst" && stock.owner_analyst_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateFields: string[] = [];
    const queryParams: any[] = [];

    if (name) {
      updateFields.push("name = ?");
      queryParams.push(name);
    }
    if (status) {
      updateFields.push("status = ?");
      queryParams.push(status);
    }

    const query = `UPDATE stocks SET ${updateFields.join(", ")} WHERE id = ?`;
    queryParams.push(stockId);

    await pool.execute(query, queryParams);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/stocks/[id]
async function deleteStock(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stockId = id;

  try {
    await pool.execute("DELETE FROM stocks WHERE id = ?", [stockId]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error(error);
    // Optional: handle FK constraint error
    // if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    //   return NextResponse.json({ error: "Cannot delete: stock has related records" }, { status: 409 });
    // }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withAuth(getStock);
export const PUT = withAuth(updateStock, ["admin", "analyst"]);
export const DELETE = withAuth(deleteStock, ["admin"]);
