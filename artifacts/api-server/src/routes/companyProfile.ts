import { Router } from "express";
import { db } from "@workspace/db";
import { companyProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpsertCompanyProfileBody } from "@workspace/api-zod";

const router = Router();
const DEFAULT_BIZ = "demo-business";

router.get("/company-profile", async (req, res) => {
  try {
    const [profile] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, DEFAULT_BIZ));
    if (!profile) return res.status(404).json({ error: "Not found" });
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/company-profile", async (req, res) => {
  try {
    const body = UpsertCompanyProfileBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, DEFAULT_BIZ));

    if (existing) {
      const [updated] = await db
        .update(companyProfilesTable)
        .set(body)
        .where(eq(companyProfilesTable.businessId, DEFAULT_BIZ))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(companyProfilesTable)
      .values({ ...body, businessId: DEFAULT_BIZ })
      .returning();
    res.json(created);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
