import type { Response } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";

export const SESSION_COOKIE = "session_token";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates a session row for the given userId and returns the raw (unhashed) token. */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}
