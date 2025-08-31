
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function deleteReference(req: AuthenticatedRequest, { params }: { params: { refId: string } }) {
  const refId = parseInt(params.refId, 10);
  const { id: userId, role } = req.user;

  try {
    const [refRows] = await pool.execute("SELECT added_by_user_id FROM references_links WHERE id = ?", [refId]);
    // @ts-ignore
    const ref = refRows[0];

    if (!ref) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    if (role === "analyst" && ref.added_by_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.execute("DELETE FROM references_links WHERE id = ?", [refId]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const DELETE = withAuth(deleteReference, ["admin", "analyst"]);
