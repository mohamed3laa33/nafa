
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { pool } from "./db";
import { env } from "./env";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await pool.execute(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [sessionId, userId, expiresAt]
  );

  return sessionId;
}

export async function deleteSession(sessionId: string) {
  await pool.execute("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

export async function getSession(sessionId: string) {
  const [rows] = await pool.execute(
    "SELECT s.id, s.user_id, s.expires_at, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > NOW()",
    [sessionId]
  );
  // @ts-ignore
  return rows[0] || null;
}
