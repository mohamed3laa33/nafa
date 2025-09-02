
import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/cookies";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: Request) {
  const body = await req.json();

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try {
    const [rows] = await pool.execute(
      "SELECT id, password_hash, role FROM users WHERE email = ?",
      [email]
    );
    // @ts-ignore
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const sessionId = await createSession(user.id);
    const res = NextResponse.json({ user: { id: user.id, email, role: user.role } });
    setSessionCookie(res, sessionId);
    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
