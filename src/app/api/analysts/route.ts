
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

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
