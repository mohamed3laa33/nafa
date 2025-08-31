
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";

export const runtime = "nodejs";

async function getMe(req: AuthenticatedRequest) {
  return NextResponse.json({ user: req.user });
}

export const GET = withAuth(getMe);
