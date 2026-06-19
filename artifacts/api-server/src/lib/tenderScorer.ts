import { db } from "@workspace/db";
import {
  tendersTable,
  matchesTable,
  companyProfilesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";

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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface AiScoreResult {
  fitScore: number;
  reasoning: string;
  pros: string[];
  risks: string[];
}

function buildScoringPrompt(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
): string {
  const tenderDetails = [
    `Başlık: ${tender.title}`,
    `Kurum: ${tender.agencyName}`,
    `Tür: ${tender.type}`,
    `İl: ${tender.il || "Belirtilmemiş"}`,
    `Tahmini Değer: ${tender.estimatedValue ? `${tender.estimatedValue.toLocaleString("tr-TR")} TL` : "Belirtilmemiş"}`,
    `CPV Kodları: ${tender.cpvCodes.length > 0 ? tender.cpvCodes.join(", ") : "Belirtilmemiş"}`,
    `Son Başvuru: ${tender.deadline ? tender.deadline.toLocaleDateString("tr-TR") : "Belirtilmemiş"}`,
    `Durum: ${tender.status}`,
    tender.description ? `Açıklama: ${tender.description.slice(0, 500)}` : null,
    tender.qualificationCriteria.length > 0
      ? `Yeterlilik Kriterleri: ${tender.qualificationCriteria.slice(0, 5).join("; ")}`
      : null,
  ].filter(Boolean).join("\n");

  const aiSummarySection = tender.aiSummary
    ? [
        "\n--- Belge Analizi ---",
        `Özet: ${tender.aiSummary.summary}`,
        tender.aiSummary.requiredTurnover
          ? `Gerekli Ciro: ${tender.aiSummary.requiredTurnover.toLocaleString("tr-TR")} TL`
          : null,
        tender.aiSummary.experienceYears
          ? `Gerekli Deneyim: ${tender.aiSummary.experienceYears} yıl`
          : null,
        tender.aiSummary.personnelCount
          ? `Gerekli Personel: ${tender.aiSummary.personnelCount}`
          : null,
        tender.aiSummary.technicalSpecs.length > 0
          ? `Teknik Gereksinimler: ${tender.aiSummary.technicalSpecs.slice(0, 5).join("; ")}`
          : null,
      ].filter(Boolean).join("\n")
    : "";

  const profileDetails = [
    `Şirket: ${profile.companyName}`,
    profile.aiBrief ? `Firma Özeti: ${profile.aiBrief}` : null,
    profile.cpvCodes.length > 0 ? `CPV Kodları: ${profile.cpvCodes.join(", ")}` : null,
    profile.naceCodes.length > 0 ? `NACE Kodları: ${profile.naceCodes.join(", ")}` : null,
    profile.certifications.length > 0
      ? `Sertifikalar: ${profile.certifications.join(", ")}`
      : null,
    profile.preferredProvinces.length > 0
      ? `Tercih Edilen İller: ${profile.preferredProvinces.join(", ")}`
      : null,
    profile.excludedProvinces.length > 0
      ? `Hariç Tutulan İller: ${profile.excludedProvinces.join(", ")}`
      : null,
    profile.experienceCeiling
      ? `Deneyim Üst Limiti: ${profile.experienceCeiling.toLocaleString("tr-TR")} TL`
      : null,
    profile.annualRevenue
      ? `Yıllık Ciro: ${profile.annualRevenue.toLocaleString("tr-TR")} TL`
      : null,
    profile.personnelCount ? `Personel Sayısı: ${profile.personnelCount}` : null,
  ].filter(Boolean).join("\n");

  return `Sen bir ihale uyum analisti olarak çalışıyorsun. Aşağıdaki ihale ve şirket profilini değerlendirerek uyum skorunu belirle.

## İhale Bilgileri
${tenderDetails}${aiSummarySection}

## Şirket Profili
${profileDetails}

## Görev
Bu ihalenin söz konusu şirkete ne kadar uygun olduğunu 0-100 arasında bir skorla değerlendir. Şunları dikkate al:
1. CPV/NACE kodu örtüşmesi ve faaliyet alanı uyumu
2. Coğrafi tercihler ve konumsal uygunluk
3. Finansal yeterlilik (ciro, deneyim limiti)
4. Teknik gereksinimler ve sertifikasyon uyumu
5. İhale büyüklüğü ve şirket kapasitesi

Yanıtını YALNIZCA aşağıdaki JSON formatında ver, başka açıklama ekleme:
{
  "fitScore": <0-100 arası tamsayı>,
  "reasoning": "<tek paragraf Türkçe açıklama>",
  "pros": ["<avantaj 1>", "<avantaj 2>", "<avantaj 3>"],
  "risks": ["<risk 1>", "<risk 2>"]
}`;
}

function computeRuleBasedScore(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
): AiScoreResult {
  const pros: string[] = [];
  const risks: string[] = [];
  let score = 50;

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

  if (tender.il) {
    if (profile.excludedProvinces.includes(tender.il)) {
      score -= 20;
      risks.push(`${tender.il} hariç tutulan il listesinde`);
    } else if (
      profile.preferredProvinces.length === 0 ||
      profile.preferredProvinces.includes(tender.il)
    ) {
      score += 15;
      pros.push(`${tender.il} tercih edilen bölgede`);
    } else {
      score -= 5;
      risks.push(`${tender.il} tercih edilen bölge dışında`);
    }
  }

  if (profile.experienceCeiling && tender.estimatedValue != null && tender.estimatedValue > 0) {
    if (tender.estimatedValue <= profile.experienceCeiling) {
      score += 10;
      pros.push("İhale değeri deneyim limitinizin altında");
    } else if (tender.estimatedValue > profile.experienceCeiling * 1.5) {
      score -= 15;
      risks.push("İhale değeri deneyim limitinizi önemli ölçüde aşıyor");
    }
  }

  if (tender.status === "cancelled" || tender.status === "awarded") {
    score -= 30;
    risks.push("İhale iptal edilmiş veya sonuçlanmış olabilir");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const reasoning =
    finalScore >= 75
      ? "Profil kriterleri güçlü bir eşleşme gösteriyor."
      : finalScore >= 50
      ? "Profil kriterleriyle orta düzeyde uyum var."
      : "Bu ihale mevcut profilinizle sınırlı uyum gösteriyor.";

  return { fitScore: finalScore, pros, risks, reasoning };
}

let _aiAvailable: boolean | null = null;

function isAiAvailable(): boolean {
  if (_aiAvailable === null) {
    _aiAvailable =
      !!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL &&
      !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    if (!_aiAvailable) {
      logger.warn(
        "AI_INTEGRATIONS_ANTHROPIC_BASE_URL or AI_INTEGRATIONS_ANTHROPIC_API_KEY not set — " +
          "tender scoring will use rule-based fallback only"
      );
    }
  }
  return _aiAvailable;
}

async function scoreWithAi(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
): Promise<AiScoreResult> {
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");

  const prompt = buildScoringPrompt(tender, profile);

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 512,
    system: "Sen bir ihale uyum analisti olarak çalışıyorsun. Yalnızca geçerli JSON döndür, başka açıklama ekleme.",
    messages: [{ role: "user", content: prompt }],
  });

  const firstBlock = response.content[0];
  const content = firstBlock?.type === "text" ? firstBlock.text : null;
  if (!content) throw new Error("Empty AI response");

  const parsed = JSON.parse(content) as Partial<AiScoreResult>;
  if (
    typeof parsed.fitScore !== "number" ||
    !Array.isArray(parsed.pros) ||
    !Array.isArray(parsed.risks) ||
    typeof parsed.reasoning !== "string"
  ) {
    throw new Error("Invalid AI response shape");
  }

  return {
    fitScore: Math.max(0, Math.min(100, Math.round(parsed.fitScore))),
    reasoning: parsed.reasoning,
    pros: parsed.pros.slice(0, 5).map(String),
    risks: parsed.risks.slice(0, 5).map(String),
  };
}

interface ScoringPair {
  tender: typeof tendersTable.$inferSelect;
  profile: typeof companyProfilesTable.$inferSelect;
}

export async function scoreNewTenders(newTenderIds: number[]): Promise<ScoredMatch[]> {
  if (newTenderIds.length === 0) return [];

  const [tenders, profiles] = await Promise.all([
    db.select().from(tendersTable).where(inArray(tendersTable.id, newTenderIds)),
    db.select().from(companyProfilesTable),
  ]);

  if (tenders.length === 0 || profiles.length === 0) return [];

  const pairs: ScoringPair[] = [];
  for (const profile of profiles) {
    for (const tender of tenders) {
      pairs.push({ tender, profile });
    }
  }

  const aiEnabled = isAiAvailable();

  // Step 1: rule-based pre-filter (free, instant) — drop pairs that have no
  // realistic chance of matching before spending any AI tokens on them.
  const AI_SCORE_THRESHOLD = 40;
  const preScored = pairs.map((p) => ({
    ...p,
    ruleScore: computeRuleBasedScore(p.tender, p.profile),
  }));
  const aiCandidates = preScored.filter((p) => p.ruleScore.fitScore >= AI_SCORE_THRESHOLD);
  const ruledOut = preScored.filter((p) => p.ruleScore.fitScore < AI_SCORE_THRESHOLD);

  logger.info(
    {
      pairs: pairs.length,
      tenders: tenders.length,
      profiles: profiles.length,
      aiEnabled,
      aiCandidates: aiCandidates.length,
      skippedByRules: ruledOut.length,
    },
    "Starting tender scoring (rule pre-filter applied)"
  );

  // Step 2: AI scoring only for candidates that passed the rule threshold.
  type PreScoredPair = (typeof aiCandidates)[number];
  const scoredPairs = await batchProcess(
    aiCandidates,
    async ({ tender, profile, ruleScore }: PreScoredPair) => {
      let result: AiScoreResult;
      if (aiEnabled) {
        try {
          result = await scoreWithAi(tender, profile);
          logger.debug(
            { tenderId: tender.id, businessId: profile.businessId, fitScore: result.fitScore },
            "AI scoring succeeded"
          );
        } catch (err) {
          logger.warn(
            { err, tenderId: tender.id, businessId: profile.businessId },
            "AI scoring failed — falling back to rule-based"
          );
          result = ruleScore;
        }
      } else {
        result = ruleScore;
      }
      return { tender, profile, ...result };
    },
    { concurrency: 3, retries: 5 }
  );

  // Step 3: include ruled-out pairs with their rule score so they still get a
  // match record (just never surface above notification threshold).
  const ruledOutScored = ruledOut.map(({ tender, profile, ruleScore }) => ({
    tender,
    profile,
    ...ruleScore,
  }));

  const results: ScoredMatch[] = [];

  // Merge AI-scored and rule-only results into one list for DB persistence.
  const allScored = [
    ...(scoredPairs.filter(Boolean) as NonNullable<(typeof scoredPairs)[number]>[]),
    ...ruledOutScored,
  ];

  for (const item of allScored) {
    const { tender, profile, fitScore, reasoning, pros, risks } = item;

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
          .set({ fitScore, reasoning, pros, risks, status: "new" })
          .where(eq(matchesTable.id, existing[0].id));
        matchId = existing[0].id;
      } else {
        const [inserted] = await db
          .insert(matchesTable)
          .values({
            businessId: profile.businessId,
            tenderId: tender.id,
            fitScore,
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
        fitScore,
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
      logger.warn(
        { err, tenderId: tender.id, businessId: profile.businessId },
        "Failed to upsert match"
      );
    }
  }

  logger.info({ scored: results.length }, "Tender scoring complete");
  return results;
}
