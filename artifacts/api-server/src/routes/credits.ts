import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserId, requireAuth } from "../lib/authHelpers.js";

const router = Router();

/**
 * GET /api/credits — return the current user's remaining AI search credits.
 * Returns { credits: number }. Pro users are not subject to credit limits, but
 * this endpoint still returns their stored value (irrelevant to them).
 * Requires a verified Clerk session — returns 401 for unauthenticated callers.
 */
router.get("/credits", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);

    const [user] = await db
      .select({ searchCredits: usersTable.searchCredits })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);

    if (!user) {
      return res.json({ credits: 2 });
    }

    res.json({ credits: user.searchCredits });
  } catch (err) {
    console.error("Credits fetch error:", err);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

export default router;
