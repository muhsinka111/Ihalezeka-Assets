import { db } from "@workspace/db";
import { companyProfilesTable } from "@workspace/db";

const BIZ = "demo-business";

/**
 * Development seed — INTENTIONALLY minimal.
 *
 * This routine must NEVER insert fabricated tenders, matches, pipeline items,
 * proposals, or AI summaries. Tenders and their matches come exclusively from
 * the real scrapers (EKAP / ilan.gov.tr / international sources) so the app
 * always reflects genuine procurement data.
 *
 * The only fixture kept here is the demo company profile, which is required for
 * the matching/scoring engine to have a business to score real tenders against.
 * It is created idempotently (only when no profile exists yet).
 */
async function seed() {
  console.log("Seeding database (company profile only)…");

  const existing = await db.select().from(companyProfilesTable).limit(1);
  if (existing.length === 0) {
    await db.insert(companyProfilesTable).values({
      businessId: BIZ,
      companyName: "Teknova Bilişim A.Ş.",
      taxNumber: "1234567890",
      mersisNumber: "0123456789000001",
      ekapNumber: "TR-2019-00123456",
      naceCodes: ["62.01", "62.02", "62.09"],
      cpvCodes: ["72000000-5", "72200000-7", "72300000-8"],
      experienceCeiling: 25_000_000,
      certifications: ["ISO 9001:2015", "ISO 27001:2013", "ISO 20000-1:2018"],
      personnelCount: 42,
      annualRevenue: 18_500_000,
      preferredProvinces: ["Ankara", "İstanbul", "İzmir"],
      excludedProvinces: [],
      discountStrategy: "Standart kırım: %8-12 arası. Mali yeterlilik sınırında %5'e kadar esneklik.",
      automationEnabled: false,
      completionStep: 4,
    });
    console.log("Inserted demo company profile");
  } else {
    console.log("Company profile already exists — nothing to seed");
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
