
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    // Some databases may not have a `name` column; alias email as a fallback display name
    const [rows] = await pool.execute(
      "SELECT id, email, email AS name FROM users WHERE role = 'analyst'"
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to fetch analysts:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysts" },
      { status: 500 }
    );
  }
}

const createAnalystSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function createAnalyst(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const parsed = createAnalystSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const [existing]: any = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (Array.isArray(existing) && existing.length) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const [result]: any = await pool.execute(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'analyst')",
      [email, passwordHash]
    );

    const id = result.insertId ?? null;
    return NextResponse.json({ id, email, role: 'analyst' }, { status: 201 });
  } catch (e) {
    console.error("Failed to create analyst:", e);
    return NextResponse.json({ error: "Failed to create analyst" }, { status: 500 });
  }
}

export const POST = withAuth(createAnalyst, ["admin"]);
