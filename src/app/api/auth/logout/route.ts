
import { NextResponse } from "next/server";
import { getSessionId, clearSessionCookie } from "@/lib/cookies";
import { deleteSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const sessionId = getSessionId();

  if (sessionId) {
    await deleteSession(sessionId);
    clearSessionCookie();
  }

  return new NextResponse(null, { status: 204 });
}
