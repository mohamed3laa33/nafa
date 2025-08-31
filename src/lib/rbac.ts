// src/lib/rbac.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/cookies";
import { pool } from "@/lib/db";

export interface AuthenticatedRequest extends NextRequest {
  user: { id: string; role: string };
}

export function withAuth<TCtx = any>(
  handler: (req: AuthenticatedRequest, ctx: TCtx) => Promise<NextResponse>,
  roles?: string[]
) {
  return async (req: NextRequest, ctx: TCtx) => {
    const sid = await getSessionId(); // <-- await
    if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await pool.execute(
      `SELECT s.user_id AS id, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
        LIMIT 1`,
      [sid]
    );
    // @ts-ignore
    const user = rows && rows[0];
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (roles && roles.length && !roles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const authReq = req as AuthenticatedRequest;
    // @ts-ignore
    authReq.user = user;
    return handler(authReq, ctx);
  };
}
