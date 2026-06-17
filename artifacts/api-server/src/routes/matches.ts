import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, tendersTable, companyProfilesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, type SQL, count } from "drizzle-orm";
import { ListMatchesQueryParams, GetMatchParams, UpdateMatchStatusParams, UpdateMatchStatusBody } from "@workspace/api-zod";
import { computeCriteriaCompliance } from "../services/document-analyzer.js";
import { requirePro } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: AI-derived matches (fit scores, pros/risks, criteria) are Pro.
router.use("/matches", requirePro);
const DEFAULT_BIZ = "demo-business";

interface ResolvedContact {
  authority: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  contactPerson: string | null;
  sourceUrl: string | null;
}

/**
 * Resolve a tender's contact for display, preferring the persisted `contact`
 * column (populated at ingest / by the backfill from real source data), then
 * the AI document extraction (aiSummary.contact), then structured raw-data
 * fields / tender columns. Live MCP details (richer) are overlaid by the
 * frontend on top of this.
 */
function buildContact(tender: any, aiSummary: any): ResolvedContact {
  const raw = (tender?.rawData as Record<string, any>) ?? {};
  const stored = (tender?.contact as Record<string, any>) ?? {};
  const c = aiSummary?.contact ?? {};
  const pick = (...vals: any[]) =>
    vals.find((v) => typeof v === "string" && v.trim().length > 0)?.trim() ?? null;

  return {
    authority: pick(stored.authority, c.authority, raw.idareAdi, raw.advertiserName, tender?.agencyName),
    address: pick(stored.address, c.address, raw.adres, raw.addressCityName),
    phone: pick(stored.phone, c.phone),
    fax: pick(stored.fax, c.fax),
    email: pick(stored.email, c.email),
    contactPerson: pick(stored.contactPerson, c.contactPerson),
    sourceUrl: pick(tender?.sourceUrl, raw.link, raw.url),
  };
}

const formatMatch = (m: any, t: any) => ({
  id: m.id,
  tender: {
    ...t,
    deadline: t.deadline instanceof Date ? t.deadline.toISOString() : t.deadline,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
  },
  fitScore: m.fitScore,
  reasoning: m.reasoning,
  pros: m.pros,
  risks: m.risks,
  status: m.status,
  aiSummary: t.aiSummary ?? null,
  createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
});

router.get("/matches", async (req, res) => {
  try {
    const query = ListMatchesQueryParams.parse(req.query);
    const conditions: SQL[] = [eq(matchesTable.businessId, DEFAULT_BIZ)];
    if (query.status) conditions.push(eq(matchesTable.status, query.status));
    if (query.minFit) conditions.push(gte(matchesTable.fitScore, query.minFit));
    if (query.maxFit) conditions.push(lte(matchesTable.fitScore, query.maxFit));

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(matchesTable)
        .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
        .where(and(...conditions))
        .orderBy(desc(matchesTable.fitScore))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(matchesTable).where(and(...conditions)),
    ]);

    res.json({
      items: rows.map((r) => formatMatch(r.matches, r.tenders)),
      total: Number(totalResult[0]?.total ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/matches/:tenderId", async (req, res) => {
  try {
    const { tenderId } = GetMatchParams.parse(req.params);

    // Try the full match row first (has fit score, pros/risks, AI summary)
    const [row] = await db
      .select()
      .from(matchesTable)
      .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
      .where(and(eq(matchesTable.tenderId, tenderId), eq(matchesTable.businessId, DEFAULT_BIZ)));

    let tenderRow: typeof tendersTable.$inferSelect;
    let matchPayload: ReturnType<typeof formatMatch>;

    if (row) {
      matchPayload = formatMatch(row.matches, row.tenders);
      tenderRow = row.tenders;
    } else {
      // No match record yet — fall back to the raw tender so the detail page
      // can still render (documents, description, deadline, etc.).
      const [tender] = await db
        .select()
        .from(tendersTable)
        .where(eq(tendersTable.id, tenderId));
      if (!tender) return res.status(404).json({ error: "Not found" });

      // Inject EKAP portal URL when documents are empty (same as GET /tenders/:id)
      const storedDocs = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];
      const finalTender =
        storedDocs.length === 0 && tender.sourceSystem === "ekap" && tender.ikn
          ? {
              ...tender,
              documents: [
                {
                  name: "İhale Dokümanı (EKAP Portal)",
                  url: tender.sourceUrl ?? `https://ekapv2.kik.gov.tr/ekap/detay/${tender.ikn}`,
                  type: "ekap-portal",
                },
              ],
            }
          : tender;

      tenderRow = finalTender as typeof tendersTable.$inferSelect;
      // Return a match-shaped response with null fit-score fields
      matchPayload = formatMatch(
        { id: null, fitScore: null, reasoning: null, pros: null, risks: null, status: "pending", createdAt: null },
        tenderRow,
      );
    }

    const tenderAny = tenderRow as any;
    const aiSummary = tenderAny.aiSummary ?? null;
    const contact = buildContact(tenderAny, aiSummary);

    const [profile] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, DEFAULT_BIZ))
      .limit(1);

    let criteriaCompliance: Array<{ criterion: string; compliant: boolean | null; note: string | null }>;

    if (aiSummary) {
      criteriaCompliance = computeCriteriaCompliance(aiSummary, {
        annualRevenue: profile?.annualRevenue ?? null,
        experienceCeiling: profile?.experienceCeiling ?? null,
        personnelCount: profile?.personnelCount ?? null,
      });
    } else if ((tenderRow as any).qualificationCriteria?.length > 0) {
      criteriaCompliance = ((tenderRow as any).qualificationCriteria || []).map((c: string) => ({
        criterion: c,
        compliant: null as any,
        note: "Belge analizi yapılmadı — kesin uyum bilinmiyor",
      }));
    } else {
      criteriaCompliance = [];
    }

    res.json({ ...matchPayload, criteriaCompliance, aiSummary, contact });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/matches/:tenderId/status", async (req, res) => {
  try {
    const { tenderId } = UpdateMatchStatusParams.parse(req.params);
    const body = UpdateMatchStatusBody.parse(req.body);

    const [updated] = await db
      .update(matchesTable)
      .set({ status: body.status })
      .where(and(eq(matchesTable.tenderId, tenderId), eq(matchesTable.businessId, DEFAULT_BIZ)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    const [row] = await db
      .select()
      .from(matchesTable)
      .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
      .where(eq(matchesTable.id, updated.id));

    res.json(formatMatch(row.matches, row.tenders));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
