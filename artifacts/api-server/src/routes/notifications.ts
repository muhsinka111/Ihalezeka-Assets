import { Router } from "express";
import { db } from "@workspace/db";
import {
  notificationsTable,
  notificationPreferencesTable,
} from "@workspace/db";
import { eq, and, isNull, desc, count, gt } from "drizzle-orm";
import { getBusinessId } from "../lib/authHelpers.js";
import { addSseClient } from "../lib/sseManager.js";
import { getEmailProvider } from "../lib/emailService.js";

const router = Router();

// ── Input validation ──────────────────────────────────────────────────────

const ALLOWED_SOURCES = new Set(["ekap", "ilan_gov"]);
const ALLOWED_CATEGORIES = new Set(["Yapım", "Mal Alımı", "Hizmet Alımı", "Danışmanlık", "İhale"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PrefsBody {
  emailEnabled?: boolean;
  emailAddress?: string | null;
  inAppEnabled?: boolean;
  minFitScore?: number;
  sources?: string[];
  categories?: string[];
}

function validatePrefsBody(body: unknown): { ok: true; data: PrefsBody } | { ok: false; errors: string[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["Request body must be an object"] };
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  if ("emailEnabled" in b && typeof b.emailEnabled !== "boolean") errors.push("emailEnabled must be a boolean");
  if ("inAppEnabled" in b && typeof b.inAppEnabled !== "boolean") errors.push("inAppEnabled must be a boolean");

  if ("emailAddress" in b && b.emailAddress !== null && b.emailAddress !== undefined) {
    if (typeof b.emailAddress !== "string" || !EMAIL_RE.test(b.emailAddress)) {
      errors.push("emailAddress must be a valid email address");
    }
  }

  if ("minFitScore" in b) {
    const s = b.minFitScore;
    if (typeof s !== "number" || !Number.isInteger(s) || s < 0 || s > 100) {
      errors.push("minFitScore must be an integer between 0 and 100");
    }
  }

  if ("sources" in b) {
    if (!Array.isArray(b.sources)) {
      errors.push("sources must be an array");
    } else {
      const invalid = (b.sources as unknown[]).filter((s) => !ALLOWED_SOURCES.has(s as string));
      if (invalid.length) errors.push(`Invalid sources: ${invalid.join(", ")}. Allowed: ${[...ALLOWED_SOURCES].join(", ")}`);
    }
  }

  if ("categories" in b) {
    if (!Array.isArray(b.categories)) {
      errors.push("categories must be an array");
    } else {
      const invalid = (b.categories as unknown[]).filter((c) => !ALLOWED_CATEGORIES.has(c as string));
      if (invalid.length) errors.push(`Invalid categories: ${invalid.join(", ")}`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: b as PrefsBody };
}

// ── Routes ────────────────────────────────────────────────────────────────

router.get("/notifications/stream", (req, res) => {
  let businessId: string;
  try {
    businessId = getBusinessId(req);
  } catch {
    res.status(401).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(": connected\n\n");

  const cleanup = addSseClient(businessId, res);

  req.on("close", cleanup);
});

router.get("/notifications", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.businessId, businessId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    const [unreadResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.businessId, businessId),
          isNull(notificationsTable.readAt)
        )
      );

    res.json({
      items: rows.map((n) => ({
        ...n,
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
        readAt: n.readAt instanceof Date ? n.readAt.toISOString() : n.readAt,
      })),
      unreadCount: Number(unreadResult?.count ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/mark-all-read", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.businessId, businessId),
          isNull(notificationsTable.readAt)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const id = parseInt(req.params.id);

    if (isNaN(id)) return res.status(400).json({ error: "Invalid notification id" });

    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.businessId, businessId)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notification-preferences", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const [pref] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.businessId, businessId));

    if (!pref) {
      const [created] = await db
        .insert(notificationPreferencesTable)
        .values({
          businessId,
          inAppEnabled: true,
          emailEnabled: false,
          minFitScore: 60,
          sources: ["ekap", "ilan_gov"],
          categories: [],
        })
        .returning();
      return res.json(created);
    }

    res.json(pref);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/notification-preferences", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const parsed = validatePrefsBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        error: "Geçersiz tercih değerleri",
        details: parsed.errors,
      });
    }
    const body = parsed.data;

    const [existing] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.businessId, businessId));

    if (existing) {
      const [updated] = await db
        .update(notificationPreferencesTable)
        .set({
          ...(body.emailEnabled !== undefined && { emailEnabled: body.emailEnabled }),
          ...(body.emailAddress !== undefined && { emailAddress: body.emailAddress }),
          ...(body.inAppEnabled !== undefined && { inAppEnabled: body.inAppEnabled }),
          ...(body.minFitScore !== undefined && { minFitScore: body.minFitScore }),
          ...(body.sources !== undefined && { sources: body.sources }),
          ...(body.categories !== undefined && { categories: body.categories }),
        })
        .where(eq(notificationPreferencesTable.businessId, businessId))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(notificationPreferencesTable)
      .values({
        businessId,
        inAppEnabled: body.inAppEnabled ?? true,
        emailEnabled: body.emailEnabled ?? false,
        emailAddress: body.emailAddress ?? null,
        minFitScore: body.minFitScore ?? 60,
        sources: body.sources ?? ["ekap", "ilan_gov"],
        categories: body.categories ?? [],
      })
      .returning();

    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/update-last-visit", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const now = new Date();

    const [existing] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.businessId, businessId));

    if (existing) {
      await db
        .update(notificationPreferencesTable)
        .set({ lastVisitedAt: now })
        .where(eq(notificationPreferencesTable.businessId, businessId));
    } else {
      await db.insert(notificationPreferencesTable).values({
        businessId,
        lastVisitedAt: now,
        inAppEnabled: true,
        emailEnabled: false,
        minFitScore: 60,
        sources: ["ekap", "ilan_gov"],
        categories: [],
      });
    }
    res.json({ ok: true, lastVisitedAt: now.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/email-status", (_req, res) => {
  const provider = getEmailProvider();
  const displayProvider =
    provider === "resend-connector" || provider === "resend-key" ? "resend" : provider;
  res.json({
    configured: provider !== null,
    provider: displayProvider,
  });
});

router.post("/notification-preferences/test-email", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const [pref] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.businessId, businessId));

    if (!pref?.emailAddress) {
      return res.status(400).json({ error: "E-posta adresi kayıtlı değil" });
    }

    const { sendEmail, buildMatchEmailHtml } = await import("../lib/emailService.js");

    const html = buildMatchEmailHtml([
      { title: "Test İhalesi — E-posta Bildirim Testi", fitScore: 85, agencyName: "İhaleZeka Test Servisi", sourceUrl: null },
    ]);

    const sent = await sendEmail({
      to: pref.emailAddress,
      subject: "İhaleZeka: E-posta Bildirimleri Aktif",
      html,
    });

    if (sent) {
      res.json({ ok: true, to: pref.emailAddress });
    } else {
      res.status(503).json({ error: "E-posta gönderilemedi — e-posta sağlayıcısı yapılandırılmamış veya bir hata oluştu" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notifications/new-since-last-visit", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const [pref] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.businessId, businessId));

    const lastVisit = pref?.lastVisitedAt;
    if (!lastVisit) {
      return res.json({ count: 0, lastVisitedAt: null });
    }

    const [result] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.businessId, businessId),
          gt(notificationsTable.createdAt, lastVisit)
        )
      );

    res.json({
      count: Number(result?.count ?? 0),
      lastVisitedAt: lastVisit.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
