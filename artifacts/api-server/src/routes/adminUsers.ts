import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, companyProfilesTable } from "@workspace/db";
import { eq, sql, desc, ilike, or } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { invalidateEntitlement } from "../lib/authHelpers.js";

const router = Router();

const ADMIN_USER_ID = process.env["ADMIN_USER_ID"];

async function checkIsAdmin(req: Request): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  if (ADMIN_USER_ID && userId === ADMIN_USER_ID) return true;
  try {
    const [row] = await db
      .select({ isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);
    return row?.isAdmin ?? false;
  } catch {
    return false;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(await checkIsAdmin(req))) {
    res.status(403).json({ error: "Admin erişimi gereklidir" });
    return;
  }
  next();
}

router.use("/admin/users", requireAdmin);
router.use("/admin/stats", requireAdmin);

router.get("/admin/users", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const offset = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    // Build the WHERE clause — search is applied at SQL level so count/pages are accurate
    const searchFilter = search
      ? or(
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.userId, `%${search}%`),
        )
      : undefined;

    const baseQuery = db
      .select({
        id: usersTable.id,
        userId: usersTable.userId,
        email: usersTable.email,
        searchCredits: usersTable.searchCredits,
        isAdmin: usersTable.isAdmin,
        isProOverride: usersTable.isProOverride,
        stripeCustomerId: usersTable.stripeCustomerId,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable);

    const [users, countResult] = await Promise.all([
      (searchFilter ? baseQuery.where(searchFilter) : baseQuery)
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset),
      (searchFilter
        ? db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(searchFilter)
        : db.select({ count: sql<number>`count(*)::int` }).from(usersTable)),
    ]);

    const total = countResult[0]?.count ?? 0;
    const userIds = users.map((u) => u.userId);

    const profiles =
      userIds.length > 0
        ? await db
            .select({
              businessId: companyProfilesTable.businessId,
              completionStep: companyProfilesTable.completionStep,
              companyName: companyProfilesTable.companyName,
            })
            .from(companyProfilesTable)
            .where(
              sql`${companyProfilesTable.businessId} = ANY(ARRAY[${sql.join(
                userIds.map((id) => sql`${id}`),
                sql`, `,
              )}])`
            )
        : [];

    const profileMap = new Map(profiles.map((p) => [p.businessId, p]));

    let proUserIds = new Set<string>();
    try {
      const proResult = await db.execute<{ user_id: string }>(sql`
        SELECT u.user_id
        FROM users u
        INNER JOIN stripe.subscriptions s ON s.customer = u.stripe_customer_id
        WHERE s.status IN ('active', 'trialing')
      `);
      proUserIds = new Set((proResult as any).rows?.map((r: any) => r.user_id) ?? []);
    } catch {
      // Stripe schema not connected yet
    }

    const MAX_STEPS = 7;
    const enriched = users.map((u) => {
      const profile = profileMap.get(u.userId);
      const completionPct = profile
        ? Math.round((Math.min(profile.completionStep, MAX_STEPS) / MAX_STEPS) * 100)
        : 0;
      return {
        ...u,
        isPro: u.isProOverride || proUserIds.has(u.userId),
        companyName: profile?.companyName ?? null,
        profileCompletionPct: completionPct,
      };
    });

    res.json({ users: enriched, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin users");
    res.status(500).json({ error: "Kullanıcılar alınamadı" });
  }
});

router.get("/admin/stats", async (_req, res) => {
  try {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);

    const total = totalResult?.count ?? 0;

    // Count Pro users from local DB override first (always available)
    const [localProResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.isProOverride, true));
    let proCount = localProResult?.count ?? 0;

    // Try to augment with real Stripe subscribers (union to avoid double-counting)
    try {
      const stripeProResult = await db.execute<{ count: string }>(sql`
        SELECT count(DISTINCT u.user_id)::int as count
        FROM users u
        INNER JOIN stripe.subscriptions s ON s.customer = u.stripe_customer_id
        WHERE s.status IN ('active', 'trialing')
          AND u.is_pro_override = false
      `);
      const stripeCount = parseInt(String((stripeProResult as any).rows?.[0]?.count ?? "0"));
      proCount += stripeCount;
    } catch {
      // Stripe schema not connected — proCount from local override only
    }

    const mrr = proCount * 99;
    res.json({ totalUsers: total, proCount, mrr });
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin stats");
    res.status(500).json({ error: "İstatistikler alınamadı" });
  }
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const { isAdmin, isProOverride, searchCredits } = req.body as {
      isAdmin?: boolean;
      isProOverride?: boolean;
      searchCredits?: number;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (typeof isAdmin === "boolean") updates.isAdmin = isAdmin;
    if (typeof isProOverride === "boolean") updates.isProOverride = isProOverride;
    if (typeof searchCredits === "number" && searchCredits >= 0) updates.searchCredits = searchCredits;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Güncellenecek alan bulunamadı" });
      return;
    }

    const [row] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return;
    }

    // Invalidate entitlement cache when Pro override changes so the user sees
    // the new plan immediately on their next request.
    if (typeof isProOverride === "boolean") {
      invalidateEntitlement(row.userId);
    }

    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to patch admin user");
    res.status(500).json({ error: "Kullanıcı güncellenemedi" });
  }
});

const ADMIN_CLERK_USER_ID = "user_3FXTJpEbRYjciktMvEP6P5DfimG";

router.post("/admin/dev-token", async (req, res) => {
  const clerkSecretKey = process.env["CLERK_SECRET_KEY"];
  if (!clerkSecretKey) {
    res.status(500).json({ error: "CLERK_SECRET_KEY not set" });
    return;
  }

  try {
    const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 120 }),
    });

    const data = (await response.json()) as { token?: string; errors?: unknown };
    if (!data.token) {
      res.status(500).json({ error: "Token alınamadı", detail: data.errors });
      return;
    }

    res.json({ token: data.token });
  } catch (err) {
    logger.error({ err }, "Failed to generate admin sign-in token");
    res.status(500).json({ error: "Token oluşturulamadı" });
  }
});

export { checkIsAdmin };
export default router;
