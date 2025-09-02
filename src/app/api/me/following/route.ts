
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface FollowingRow extends RowDataPacket {
  following_id: string;
}

async function getFollowingHandler(req: AuthenticatedRequest) {
  const followerId = req.user.id;

  try {
    const [rows] = await pool.execute<FollowingRow[]>(
      "SELECT following_id FROM follows WHERE follower_id = ?",
      [followerId]
    );
    const followingIds = rows.map((row) => row.following_id);
    return NextResponse.json(followingIds);
  } catch (error) {
    console.error("Failed to fetch following list:", error);
    return NextResponse.json(
      { error: "Failed to fetch following list" },
      { status: 500 }
    );
  }
}

// Allow viewers (primary use-case) and analysts (to render page without 403s)
export const GET = withAuth(getFollowingHandler, ["viewer", "analyst"]);
