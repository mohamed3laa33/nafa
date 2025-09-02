
import { NextResponse } from "next/server";
import { getSessionId, clearSessionCookie } from "@/lib/cookies";
import { deleteSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const sid = await getSessionId();
  const res = new NextResponse(null, { status: 204 });
  if (sid) {
    await deleteSession(sid);
  }
  clearSessionCookie(res);
  return res;
}
