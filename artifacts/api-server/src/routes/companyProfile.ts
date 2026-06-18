import { Router } from "express";
import { db } from "@workspace/db";
import { companyProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpsertCompanyProfileBody } from "@workspace/api-zod";
import { getUserId } from "../lib/authHelpers.js";

const router = Router();

/**
 * Resolve the businessId for the current request. When the user is authenticated
 * via Clerk, their Clerk userId IS their businessId (1:1 mapping). When running
 * in dev-bypass mode the shared "demo-business" sentinel is preserved so local
 * dev still works without any auth.
 */
function getBusinessId(req: Parameters<typeof getUserId>[0]): string {
  const userId = getUserId(req);
  if (userId === "demo-user") return "demo-business";
  return userId;
}

router.get("/company-profile", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const [profile] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, businessId));
    if (!profile) return res.status(404).json({ error: "Not found" });
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/company-profile", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const body = UpsertCompanyProfileBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, businessId));

    if (existing) {
      const [updated] = await db
        .update(companyProfilesTable)
        .set(body)
        .where(eq(companyProfilesTable.businessId, businessId))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(companyProfilesTable)
      .values({ ...body, businessId })
      .returning();
    res.json(created);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
