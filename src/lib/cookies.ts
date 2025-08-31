// src/lib/cookies.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const COOKIE_NAME = env.SESSION_COOKIE_NAME || "nfaa_sid";

export async function getSessionId(): Promise<string | null> {
  const store = await cookies(); // <-- must await in Next 15
  return store.get(COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
