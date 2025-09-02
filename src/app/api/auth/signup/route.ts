import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/cookies";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["viewer", "analyst"]).default("viewer"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, role } = parsed.data;
    const passwordHash = await hashPassword(parsed.data.password);

    // Ensure unique email
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    // @ts-ignore
    if (existing && existing.length) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Create user with requested role (viewer or analyst)
    const [result]: any = await pool.execute(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, passwordHash, role]
    );

    const userId = result.insertId ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Create session and set cookie
    const sessionId = await createSession(userId);
    const res = NextResponse.json({ user: { id: userId, email, role } }, { status: 201 });
    setSessionCookie(res, sessionId);
    return res;
  } catch (e) {
    console.error("[signup] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
