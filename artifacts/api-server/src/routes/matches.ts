import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, tendersTable } from "@workspace/db";
import { eq, and, gte, lte, desc, type SQL, count } from "drizzle-orm";
import { ListMatchesQueryParams, GetMatchParams, UpdateMatchStatusParams, UpdateMatchStatusBody } from "@workspace/api-zod";

const router = Router();
const DEFAULT_BIZ = "demo-business";

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
    const [row] = await db
      .select()
      .from(matchesTable)
      .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
      .where(and(eq(matchesTable.tenderId, tenderId), eq(matchesTable.businessId, DEFAULT_BIZ)));
    if (!row) return res.status(404).json({ error: "Not found" });

    const match = formatMatch(row.matches, row.tenders);
    const criteriaCompliance = (row.tenders.qualificationCriteria || []).map((c: string) => ({
      criterion: c,
      compliant: Math.random() > 0.3,
      note: null,
    }));
    res.json({ ...match, criteriaCompliance });
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
