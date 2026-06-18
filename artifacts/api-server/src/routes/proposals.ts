import { Router } from "express";
import { db } from "@workspace/db";
import { proposalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetProposalParams } from "@workspace/api-zod";
import { requirePro, getBusinessId } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: the proposal builder (Teklif Oluşturucu) is a Pro power tool.
router.use("/proposals", requirePro);

const fmt = (p: any) => ({
  ...p,
  createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
  updatedAt: p.updatedAt?.toISOString?.() ?? p.updatedAt,
});

router.get("/proposals", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(proposalsTable)
      .where(eq(proposalsTable.businessId, getBusinessId(req)));
    res.json(items.map(fmt));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/proposals", async (req, res) => {
  try {
    const { tenderId, contentJson } = req.body;
    const [proposal] = await db
      .insert(proposalsTable)
      .values({ tenderId, contentJson, businessId: getBusinessId(req), status: "draft" })
      .returning();
    res.status(201).json(fmt(proposal));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/proposals/:id", async (req, res) => {
  try {
    const { id } = GetProposalParams.parse(req.params);
    const [proposal] = await db
      .select()
      .from(proposalsTable)
      .where(and(eq(proposalsTable.id, id), eq(proposalsTable.businessId, getBusinessId(req))));
    if (!proposal) return res.status(404).json({ error: "Not found" });
    res.json(fmt(proposal));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/proposals/:id", async (req, res) => {
  try {
    const { id } = GetProposalParams.parse(req.params);
    const { contentJson, status } = req.body;
    const [updated] = await db
      .update(proposalsTable)
      .set({ contentJson, status })
      .where(and(eq(proposalsTable.id, id), eq(proposalsTable.businessId, getBusinessId(req))))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(fmt(updated));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
