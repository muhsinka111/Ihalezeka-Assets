import { Router } from "express";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, type SQL, desc, asc, count } from "drizzle-orm";
import { ListTendersQueryParams, GetTenderParams } from "@workspace/api-zod";
import { analyzeDocuments } from "../services/document-analyzer.js";

const router = Router();

router.get("/tenders", async (req, res) => {
  try {
    const query = ListTendersQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.q) conditions.push(ilike(tendersTable.title, `%${query.q}%`));
    if (query.il) conditions.push(ilike(tendersTable.il, query.il));
    if (query.tur) conditions.push(eq(tendersTable.type, query.tur));
    if (query.usul) conditions.push(eq(tendersTable.method, query.usul));
    if (query.idare) conditions.push(ilike(tendersTable.agencyName, `%${query.idare}%`));
    if (query.minBedel) conditions.push(gte(tendersTable.estimatedValue, query.minBedel));
    if (query.maxBedel) conditions.push(lte(tendersTable.estimatedValue, query.maxBedel));
    if (query.source) conditions.push(eq(tendersTable.sourceSystem, query.source));
    if (query.durum) conditions.push(eq(tendersTable.status, query.durum));
    if (query.deadlineFrom) conditions.push(gte(tendersTable.deadline, new Date(query.deadlineFrom)));
    if (query.deadlineTo) conditions.push(lte(tendersTable.deadline, new Date(query.deadlineTo)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const sortDir = query.sortDir === "desc" ? desc : asc;
    const sortCol =
      query.sortBy === "estimatedValue" ? tendersTable.estimatedValue :
      query.sortBy === "createdAt" ? tendersTable.createdAt :
      tendersTable.deadline;
    const orderClause = sortDir(sortCol);

    const [items, totalResult] = await Promise.all([
      db.select().from(tendersTable).where(where).orderBy(orderClause).limit(limit).offset(offset),
      db.select({ total: count() }).from(tendersTable).where(where),
    ]);

    res.json({ items, total: Number(totalResult[0]?.total ?? 0), page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tenders/:id", async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });
    res.json(tender);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tenders/:id/analyze", async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    const documents = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];

    const { analysis, docsDownloaded, docsTotal } = await analyzeDocuments({
      tenderTitle: tender.title,
      tenderType: tender.type ?? undefined,
      tenderMethod: tender.method ?? undefined,
      agencyName: tender.agencyName ?? undefined,
      documents,
    });

    const existingRawData = (tender.rawData as Record<string, unknown>) ?? {};
    const updatedRawData = { ...existingRawData, _aiAnalysis: analysis };

    await db
      .update(tendersTable)
      .set({ aiSummary: analysis, rawData: updatedRawData, updatedAt: new Date() })
      .where(eq(tendersTable.id, id));

    res.json({ ok: true, analysis, docsDownloaded, docsTotal });
  } catch (err) {
    console.error("Tender analyze error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
