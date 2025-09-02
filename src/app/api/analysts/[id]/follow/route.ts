
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";

async function followHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const followerId = req.user.id;
  const { id } = await params;
  const followingId = id;

  // Prevent self-follow
  if (String(followerId) === String(followingId)) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  try {
    await pool.execute(
      "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
      [followerId, followingId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    // handle duplicate follows gracefully if unique constraint exists
    // @ts-ignore
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: true });
    }
    console.error("Failed to follow analyst:", error);
    return NextResponse.json(
      { error: "Failed to follow analyst" },
      { status: 500 }
    );
  }
}

async function unfollowHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const followerId = req.user.id;
  const { id } = await params;
  const followingId = id;

  try {
    await pool.execute(
      "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
      [followerId, followingId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unfollow analyst:", error);
    return NextResponse.json(
      { error: "Failed to unfollow analyst" },
      { status: 500 }
    );
  }
}

export const POST = withAuth(followHandler, ["viewer"]);
export const DELETE = withAuth(unfollowHandler, ["viewer"]);
