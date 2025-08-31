import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

// GET /api/stocks/[id]/refs
async function getReferences(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> } // Next 15: await params
) {
  const { id } = await params;
  const stockId = id; // UUID

  const [rows] = await pool.execute(
    "SELECT * FROM references_links WHERE stock_id = ? ORDER BY created_at DESC",
    [stockId]
  );

  // @ts-ignore
  return NextResponse.json({ data: rows || [] });
}

// POST /api/stocks/[id]/refs
const createRefSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
});

async function createReference(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stockId = id; // UUID
  const { id: userId } = req.user;

  const body = await req.json();
  const parsed = createRefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { title, url, note } = parsed.data;

  // If references_links.id is UUID (CHAR(36)):
  const refId = uuidv4();

  await pool.execute(
    `INSERT INTO references_links (id, stock_id, title, url, note, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [refId, stockId, title, url, note ?? null, userId]
  );

  return NextResponse.json({ id: refId }, { status: 201 });
}

export const GET = withAuth(getReferences);
export const POST = withAuth(createReference, ["admin", "analyst"]);
