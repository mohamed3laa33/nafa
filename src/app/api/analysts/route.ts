
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    try {
      const [rows] = await pool.execute(
        "SELECT id, email, COALESCE(username, email) AS name FROM users WHERE role = 'analyst'"
      );
      return NextResponse.json(rows);
    } catch {
      // Fallback when username column does not exist yet
      const [rows] = await pool.execute(
        "SELECT id, email, email AS name FROM users WHERE role = 'analyst'"
      );
      return NextResponse.json(rows);
    }
  } catch (error) {
    console.error("Failed to fetch analysts:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysts" },
      { status: 500 }
    );
  }
}

const createAnalystSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\.\-]+$/),
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
    const { username, email, password } = parsed.data;

    const [existing]: any = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (Array.isArray(existing) && existing.length) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const [existingUsername]: any = await pool.execute(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (Array.isArray(existingUsername) && existingUsername.length) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    let result: any;
    try {
      // Try inserting with username column; explicitly pass id=NULL for strict modes
      [result] = await pool.execute(
        "INSERT INTO users (id, username, email, password_hash, role) VALUES (NULL, ?, ?, ?, 'analyst')",
        [username, email, passwordHash]
      );
    } catch (e: any) {
      // Fallback if username column does not exist yet; keep id=NULL for strict modes
      [result] = await pool.execute(
        "INSERT INTO users (id, email, password_hash, role) VALUES (NULL, ?, ?, 'analyst')",
        [email, passwordHash]
      );
    }

    const id = result.insertId ?? null;
    return NextResponse.json({ id, username, email, role: 'analyst' }, { status: 201 });
  } catch (e) {
    console.error("Failed to create analyst:", e);
    return NextResponse.json({ error: "Failed to create analyst" }, { status: 500 });
  }
}

export const POST = withAuth(createAnalyst, ["admin"]);
