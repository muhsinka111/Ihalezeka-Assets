import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, companyProfilesTable, emailLogsTable } from "@workspace/db";
import { eq, sql, desc, ilike, or, isNotNull } from "drizzle-orm";
import crypto from "node:crypto";
import { logger } from "../lib/logger.js";
import { getUserId, invalidateEntitlement, DEFAULT_USER_ID } from "../lib/authHelpers.js";
import { createSession, setSessionCookie } from "../lib/sessionHelpers.js";
import { sendEmail } from "../lib/emailService.js";

const router = Router();

const ADMIN_USER_ID = process.env["ADMIN_USER_ID"];

async function checkIsAdmin(req: Request): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId || userId === DEFAULT_USER_ID) return false;
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

const DEV_ADMIN_EMAIL = "dev-admin@ihalezeka.local";

router.post("/admin/dev-token", async (req, res) => {
  // Dev-only convenience: signs the caller in as a standing dev-admin account
  // directly (no external identity provider round-trip). This MUST never be
  // reachable in production — gate strictly on NODE_ENV so deployed builds
  // (NODE_ENV=production) return 404 and cannot be used to impersonate an admin.
  if (process.env["NODE_ENV"] === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    let [devAdmin] = await db
      .select({ userId: usersTable.userId })
      .from(usersTable)
      .where(eq(usersTable.email, DEV_ADMIN_EMAIL))
      .limit(1);

    if (!devAdmin) {
      const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
      await db.insert(usersTable).values({
        userId,
        email: DEV_ADMIN_EMAIL,
        name: "Dev Admin",
        isAdmin: true,
        isProOverride: true,
      });
      devAdmin = { userId };
    }

    const token = await createSession(devAdmin.userId);
    setSessionCookie(res, token);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to create dev-admin session");
    res.status(500).json({ error: "Oturum oluşturulamadı" });
  }
});

// ── Admin Email Composer ──────────────────────────────────────────────────

router.use("/admin/email", requireAdmin);

router.post("/admin/email/send", async (req, res) => {
  try {
    const { to, subject, html } = req.body as { to?: string; subject?: string; html?: string };

    if (!subject?.trim() || !html?.trim()) {
      res.status(400).json({ error: "subject ve html zorunludur" });
      return;
    }

    if (!to || !to.trim()) {
      res.status(400).json({ error: "Alıcı (to) zorunludur" });
      return;
    }

    if (to === "__all__") {
      const users = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(isNotNull(usersTable.email));

      const emails = users.map((u) => u.email).filter(Boolean) as string[];
      let sent = 0;
      let failed = 0;

      for (const email of emails) {
        const ok = await sendEmail({ to: email, subject, html });
        if (ok) {
          sent++;
          await db.insert(emailLogsTable).values({ to: email, subject, status: "sent", triggeredBy: "admin:broadcast" }).catch(() => {});
        } else {
          failed++;
          await db.insert(emailLogsTable).values({ to: email, subject, status: "failed", triggeredBy: "admin:broadcast" }).catch(() => {});
        }
      }

      res.json({ ok: true, sent, failed, total: emails.length });
      return;
    }

    const ok = await sendEmail({ to: to.trim(), subject, html });
    await db.insert(emailLogsTable).values({
      to: to.trim(),
      subject,
      status: ok ? "sent" : "failed",
      triggeredBy: "admin:manual",
    }).catch(() => {});

    if (ok) {
      res.json({ ok: true, sent: 1, failed: 0 });
    } else {
      res.status(503).json({ error: "E-posta gönderilemedi" });
    }
  } catch (err) {
    logger.error({ err }, "Admin email send error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/email/logs", async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(emailLogsTable)
      .orderBy(desc(emailLogsTable.sentAt))
      .limit(50);

    res.json({ logs });
  } catch (err) {
    logger.error({ err }, "Admin email logs fetch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/email/users", async (_req, res) => {
  try {
    const users = await db
      .select({ email: usersTable.email, userId: usersTable.userId })
      .from(usersTable)
      .where(isNotNull(usersTable.email))
      .orderBy(desc(usersTable.createdAt))
      .limit(500);

    res.json({ users: users.filter((u) => u.email), total: users.length });
  } catch (err) {
    logger.error({ err }, "Admin email users fetch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { checkIsAdmin };
export default router;
