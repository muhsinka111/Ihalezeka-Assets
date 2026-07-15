import type { RequestHandler } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { hashToken, SESSION_COOKIE } from "../lib/sessionHelpers.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

/**
 * Reads the session cookie, looks up a matching non-expired session, and
 * attaches `req.authUserId` when valid. Never blocks the request — routes
 * that require auth check `req.authUserId` themselves via authHelpers.
 */
export function sessionAuthMiddleware(): RequestHandler {
  return async (req, _res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      next();
      return;
    }

    try {
      const [session] = await db
        .select({ userId: sessionsTable.userId })
        .from(sessionsTable)
        .where(and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date())))
        .limit(1);

      if (session) {
        req.authUserId = session.userId;
      }
    } catch {
      // DB error resolving session — proceed unauthenticated rather than 500ing every request
    }

    next();
  };
}
