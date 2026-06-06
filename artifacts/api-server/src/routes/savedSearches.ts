import { Router } from "express";
import { db } from "@workspace/db";
import { savedSearchesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getBusinessId } from "../lib/authHelpers.js";
import {
  CreateSavedSearchBody,
  UpdateSavedSearchBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/saved-searches", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const rows = await db
      .select()
      .from(savedSearchesTable)
      .where(eq(savedSearchesTable.businessId, businessId))
      .orderBy(desc(savedSearchesTable.createdAt));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/saved-searches", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const parsed = CreateSavedSearchBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Geçersiz arama verisi", details: parsed.error.issues });
    }
    const { name, criteria, alertsEnabled } = parsed.data;
    const [created] = await db
      .insert(savedSearchesTable)
      .values({
        businessId,
        name,
        criteria: criteria as Record<string, unknown>,
        alertsEnabled: alertsEnabled ?? true,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/saved-searches/:id", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid saved search id" });

    const parsed = UpdateSavedSearchBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Geçersiz arama verisi", details: parsed.error.issues });
    }
    const { name, criteria, alertsEnabled } = parsed.data;

    if (name === undefined && criteria === undefined && alertsEnabled === undefined) {
      return res.status(400).json({ error: "Güncellenecek alan belirtilmedi" });
    }

    const [updated] = await db
      .update(savedSearchesTable)
      .set({
        ...(name !== undefined && { name }),
        ...(criteria !== undefined && { criteria: criteria as Record<string, unknown> }),
        ...(alertsEnabled !== undefined && { alertsEnabled }),
      })
      .where(
        and(
          eq(savedSearchesTable.id, id),
          eq(savedSearchesTable.businessId, businessId),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Saved search not found" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/saved-searches/:id", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid saved search id" });

    const deleted = await db
      .delete(savedSearchesTable)
      .where(
        and(
          eq(savedSearchesTable.id, id),
          eq(savedSearchesTable.businessId, businessId),
        ),
      )
      .returning({ id: savedSearchesTable.id });

    if (deleted.length === 0)
      return res.status(404).json({ error: "Saved search not found" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
