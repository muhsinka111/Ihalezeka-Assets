import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import { ListDocumentsQueryParams, DeleteDocumentParams } from "@workspace/api-zod";
import { getBusinessId } from "../lib/authHelpers.js";

const router = Router();

router.get("/documents", async (req, res) => {
  try {
    const query = ListDocumentsQueryParams.parse(req.query);
    const conditions: SQL[] = [eq(documentsTable.businessId, getBusinessId(req))];
    if (query.folder) conditions.push(eq(documentsTable.folder, query.folder));

    const items = await db
      .select()
      .from(documentsTable)
      .where(and(...conditions));

    res.json(items.map((d) => ({ ...d, createdAt: d.createdAt?.toISOString?.() ?? d.createdAt })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents", async (req, res) => {
  try {
    const { name, folder, fileUrl, validUntil } = req.body;
    const [doc] = await db
      .insert(documentsTable)
      .values({ name, folder, fileUrl, validUntil, businessId: getBusinessId(req), status: "valid" })
      .returning();
    res.status(201).json({ ...doc, createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const { id } = DeleteDocumentParams.parse(req.params);
    await db
      .delete(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.businessId, getBusinessId(req))));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents/folders", async (req, res) => {
  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.businessId, getBusinessId(req)));

    const folderMap: Record<string, { count: number; expiringCount: number }> = {};
    for (const doc of docs) {
      if (!folderMap[doc.folder]) folderMap[doc.folder] = { count: 0, expiringCount: 0 };
      folderMap[doc.folder].count++;
      if (doc.status === "expiring_soon") folderMap[doc.folder].expiringCount++;
    }

    res.json(
      Object.entries(folderMap).map(([name, info]) => ({ name, ...info }))
    );
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
