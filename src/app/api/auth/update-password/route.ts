import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const { oldPassword, newPassword } = await req.json();

    // TODO: get userId from session/context
    const userId = 1;

    const [rows]: any = await pool.execute("SELECT password FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const match = await bcrypt.compare(oldPassword, rows[0].password);
    if (!match) return NextResponse.json({ error: "Old password incorrect" }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute("UPDATE users SET password = ? WHERE id = ?", [hashed, userId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
