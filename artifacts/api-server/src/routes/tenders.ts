import { Router } from "express";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, type SQL, desc, count } from "drizzle-orm";
import { ListTendersQueryParams, GetTenderParams } from "@workspace/api-zod";

const router = Router();

router.get("/tenders", async (req, res) => {
  try {
    const query = ListTendersQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.q) conditions.push(ilike(tendersTable.title, `%${query.q}%`));
    if (query.il) conditions.push(eq(tendersTable.il, query.il));
    if (query.tur) conditions.push(eq(tendersTable.type, query.tur));
    if (query.usul) conditions.push(eq(tendersTable.method, query.usul));
    if (query.idare) conditions.push(ilike(tendersTable.agencyName, `%${query.idare}%`));
    if (query.minBedel) conditions.push(gte(tendersTable.estimatedValue, query.minBedel));
    if (query.maxBedel) conditions.push(lte(tendersTable.estimatedValue, query.maxBedel));
    if ((query as any).source) conditions.push(eq(tendersTable.sourceSystem, (query as any).source));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [items, totalResult] = await Promise.all([
      db.select().from(tendersTable).where(where).orderBy(desc(tendersTable.deadline)).limit(limit).offset(offset),
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

export default router;
