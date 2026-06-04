import { db } from "@workspace/db";
import {
  tendersTable,
  matchesTable,
  companyProfilesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger.js";

export interface ScoredMatch {
  tenderId: number;
  businessId: string;
  matchId: number;
  fitScore: number;
  reasoning: string;
  pros: string[];
  risks: string[];
  tenderTitle: string;
  agencyName: string;
  sourceSystem: string;
  tenderType: string;
  sourceUrl: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function computeFitScore(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
): { score: number; pros: string[]; risks: string[]; reasoning: string } {
  const pros: string[] = [];
  const risks: string[] = [];
  let score = 50;

  // CPV code overlap (up to +25 pts)
  if (profile.cpvCodes.length > 0 && tender.cpvCodes.length > 0) {
    const matchCount = profile.cpvCodes.filter((c) =>
      tender.cpvCodes.some((tc) => tc.startsWith(c.slice(0, 4)) || c.startsWith(tc.slice(0, 4)))
    ).length;
    const cpvBonus = Math.min(25, matchCount * 12);
    if (cpvBonus > 0) {
      score += cpvBonus;
      pros.push(`${matchCount} CPV kodu eşleşmesi bulundu`);
    } else {
      score -= 10;
      risks.push("CPV kodları profille örtüşmüyor");
    }
  }

  // Geographic preference (up to +15 pts)
  if (tender.il) {
    if (profile.excludedProvinces.includes(tender.il)) {
      score -= 20;
      risks.push(`${tender.il} hariç tutulan il listesinde`);
    } else if (profile.preferredProvinces.length === 0 || profile.preferredProvinces.includes(tender.il)) {
      score += 15;
      pros.push(`${tender.il} tercih edilen bölgede`);
    } else {
      score -= 5;
      risks.push(`${tender.il} tercih edilen bölge dışında`);
    }
  }

  // Experience ceiling check (up to +10 pts / -15 pts)
  if (profile.experienceCeiling && tender.estimatedValue > 0) {
    if (tender.estimatedValue <= profile.experienceCeiling) {
      score += 10;
      pros.push("İhale değeri deneyim limitinizin altında");
    } else if (tender.estimatedValue > profile.experienceCeiling * 1.5) {
      score -= 15;
      risks.push("İhale değeri deneyim limitinizi önemli ölçüde aşıyor");
    }
  }

  // Status penalty
  if (tender.status === "cancelled" || tender.status === "awarded") {
    score -= 30;
    risks.push("İhale iptal edilmiş veya sonuçlanmış olabilir");
  }

  // Clamp to [0, 100]
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  const reasoning =
    finalScore >= 75
      ? "Profil kriterleri güçlü bir eşleşme gösteriyor."
      : finalScore >= 50
      ? "Profil kriterleriyle orta düzeyde uyum var."
      : "Bu ihale mevcut profilinizle sınırlı uyum gösteriyor.";

  return { score: finalScore, pros, risks, reasoning };
}

export async function scoreNewTenders(newTenderIds: number[]): Promise<ScoredMatch[]> {
  if (newTenderIds.length === 0) return [];

  const [tenders, profiles] = await Promise.all([
    db.select().from(tendersTable).where(inArray(tendersTable.id, newTenderIds)),
    db.select().from(companyProfilesTable),
  ]);

  if (tenders.length === 0 || profiles.length === 0) return [];

  const results: ScoredMatch[] = [];

  for (const profile of profiles) {
    for (const tender of tenders) {
      const { score, pros, risks, reasoning } = computeFitScore(tender, profile);

      try {
        const existing = await db
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(
            and(
              eq(matchesTable.businessId, profile.businessId),
              eq(matchesTable.tenderId, tender.id)
            )
          )
          .limit(1);

        let matchId: number;
        if (existing.length > 0) {
          await db
            .update(matchesTable)
            .set({ fitScore: score, reasoning, pros, risks, status: "new" })
            .where(eq(matchesTable.id, existing[0].id));
          matchId = existing[0].id;
        } else {
          const [inserted] = await db
            .insert(matchesTable)
            .values({
              businessId: profile.businessId,
              tenderId: tender.id,
              fitScore: score,
              reasoning,
              pros,
              risks,
              status: "new",
            })
            .returning({ id: matchesTable.id });
          matchId = inserted.id;
        }

        results.push({
          tenderId: tender.id,
          businessId: profile.businessId,
          matchId,
          fitScore: score,
          reasoning,
          pros,
          risks,
          tenderTitle: tender.title,
          agencyName: tender.agencyName,
          sourceSystem: tender.sourceSystem,
          tenderType: tender.type,
          sourceUrl: tender.sourceUrl ?? null,
        });
      } catch (err) {
        logger.warn({ err, tenderId: tender.id, businessId: profile.businessId }, "Failed to upsert match");
      }
    }
  }

  logger.info({ scored: results.length }, "Tender scoring complete");
  return results;
}

export { escapeHtml };
