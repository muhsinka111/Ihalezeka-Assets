import { Router } from "express";
import { db } from "@workspace/db";
import { pipelineItemsTable, tendersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreatePipelineItemBody, UpdatePipelineItemParams, UpdatePipelineItemBody, DeletePipelineItemParams } from "@workspace/api-zod";
import { requirePro } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: the pipeline (Boru Hattı) is a Pro power tool.
router.use("/pipeline", requirePro);
const DEFAULT_BIZ = "demo-business";

const formatItem = (item: any, tender: any) => ({
  id: item.id,
  tender,
  stage: item.stage,
  notes: item.notes,
  createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
  updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
});

router.get("/pipeline", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(pipelineItemsTable)
      .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ));

    res.json(rows.map((r) => formatItem(r.pipeline_items, r.tenders)));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pipeline", async (req, res) => {
  try {
    const body = CreatePipelineItemBody.parse(req.body);
    const [item] = await db
      .insert(pipelineItemsTable)
      .values({ ...body, businessId: DEFAULT_BIZ })
      .returning();
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, item.tenderId));
    res.status(201).json(formatItem(item, tender));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/pipeline/:id", async (req, res) => {
  try {
    const { id } = UpdatePipelineItemParams.parse(req.params);
    const body = UpdatePipelineItemBody.parse(req.body);

    const [updated] = await db
      .update(pipelineItemsTable)
      .set(body)
      .where(and(eq(pipelineItemsTable.id, id), eq(pipelineItemsTable.businessId, DEFAULT_BIZ)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, updated.tenderId));
    res.json(formatItem(updated, tender));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/pipeline/:id", async (req, res) => {
  try {
    const { id } = DeletePipelineItemParams.parse(req.params);
    await db
      .delete(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.id, id), eq(pipelineItemsTable.businessId, DEFAULT_BIZ)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
