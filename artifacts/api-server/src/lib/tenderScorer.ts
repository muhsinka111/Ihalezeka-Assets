import { db } from "@workspace/db";
import {
  tendersTable,
  matchesTable,
  companyProfilesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";

export type BreakdownKey =
  | "cpv"
  | "experience"
  | "financial"
  | "geographic"
  | "timing"
  | "method";

export interface ScoreBreakdownItem {
  key: BreakdownKey;
  label: string;
  /** 0-100 sub-score for this dimension */
  score: number;
  /** relative weight (the six weights sum to 100) */
  weight: number;
  /** one-line Turkish rationale */
  reasoning: string;
}

/** Canonical weights for the six match-anatomy dimensions (sum = 100). */
const BREAKDOWN_WEIGHTS: Record<BreakdownKey, { label: string; weight: number }> = {
  cpv: { label: "Sektör/CPV uyumu", weight: 25 },
  experience: { label: "İş deneyim yeterliliği", weight: 20 },
  financial: { label: "Ekonomik/mali kapasite", weight: 20 },
  geographic: { label: "Coğrafi uygunluk", weight: 15 },
  timing: { label: "Süre uygunluğu", weight: 10 },
  method: { label: "İhale usulü uyumu", weight: 10 },
};

const BREAKDOWN_ORDER: BreakdownKey[] = [
  "cpv",
  "experience",
  "financial",
  "geographic",
  "timing",
  "method",
];

export interface ScoredMatch {
  tenderId: number;
  businessId: string;
  matchId: number;
  fitScore: number;
  reasoning: string;
  winnability: string;
  pros: string[];
  risks: string[];
  breakdown: ScoreBreakdownItem[];
  checklist: string[];
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
  winnability: string;
  pros: string[];
  risks: string[];
  breakdown: ScoreBreakdownItem[];
  checklist: string[];
}

/** Structured rule-based signals fed into the AI prompt (hybrid input). */
interface RuleSignals {
  cpvMatchCount: number;
  cpvProfileEmpty: boolean;
  geoStatus: "preferred" | "excluded" | "neutral" | "unknown";
  valueVsCeiling: "under" | "near" | "over" | "unknown";
  estimatedValue: number | null;
  experienceCeiling: number | null;
  daysToDeadline: number | null;
  method: string;
  statusFlag: "active" | "cancelled" | "awarded" | "other";
}

function daysUntil(deadline: Date | null): number | null {
  if (!deadline) return null;
  const ms = deadline.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function computeRuleSignals(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
): RuleSignals {
  const cpvProfileEmpty = profile.cpvCodes.length === 0;
  const cpvMatchCount =
    !cpvProfileEmpty && tender.cpvCodes.length > 0
      ? profile.cpvCodes.filter((c) =>
          tender.cpvCodes.some(
            (tc) => tc.startsWith(c.slice(0, 4)) || c.startsWith(tc.slice(0, 4)),
          ),
        ).length
      : 0;

  let geoStatus: RuleSignals["geoStatus"] = "unknown";
  if (tender.il) {
    if (profile.excludedProvinces.includes(tender.il)) geoStatus = "excluded";
    else if (
      profile.preferredProvinces.length === 0 ||
      profile.preferredProvinces.includes(tender.il)
    )
      geoStatus = "preferred";
    else geoStatus = "neutral";
  }

  let valueVsCeiling: RuleSignals["valueVsCeiling"] = "unknown";
  if (profile.experienceCeiling && tender.estimatedValue != null && tender.estimatedValue > 0) {
    if (tender.estimatedValue <= profile.experienceCeiling) valueVsCeiling = "under";
    else if (tender.estimatedValue > profile.experienceCeiling * 1.5) valueVsCeiling = "over";
    else valueVsCeiling = "near";
  }

  const statusFlag: RuleSignals["statusFlag"] =
    tender.status === "cancelled" || tender.status === "awarded"
      ? (tender.status as "cancelled" | "awarded")
      : tender.status === "active"
      ? "active"
      : "other";

  return {
    cpvMatchCount,
    cpvProfileEmpty,
    geoStatus,
    valueVsCeiling,
    estimatedValue: tender.estimatedValue ?? null,
    experienceCeiling: profile.experienceCeiling ?? null,
    daysToDeadline: daysUntil(tender.deadline),
    method: tender.method || tender.procurementMethod || "Belirtilmemiş",
    statusFlag,
  };
}

/** Compute the overall fit score as the weighted average of the breakdown. */
function weightedFitScore(breakdown: ScoreBreakdownItem[]): number {
  const totalWeight = breakdown.reduce((s, b) => s + b.weight, 0);
  if (totalWeight <= 0) return 0;
  const sum = breakdown.reduce((s, b) => s + b.score * b.weight, 0);
  return Math.max(0, Math.min(100, Math.round(sum / totalWeight)));
}

function buildScoringPrompt(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
  signals: RuleSignals,
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

  const geoText = {
    preferred: "İl, firmanın tercih ettiği/çalıştığı bölgede",
    excluded: "İl, firmanın HARİÇ TUTTUĞU bölgede",
    neutral: "İl, firmanın tercih listesinin dışında",
    unknown: "İl bilgisi yok",
  }[signals.geoStatus];
  const valueText = {
    under: "İhale bedeli, firmanın iş deneyim/kapasite limitinin altında (rahat)",
    near: "İhale bedeli, firmanın limitine yakın (sınırda)",
    over: "İhale bedeli, firmanın limitini belirgin şekilde aşıyor (zorlayıcı)",
    unknown: "Bedel/limit karşılaştırması için yeterli veri yok",
  }[signals.valueVsCeiling];
  const deadlineText =
    signals.daysToDeadline == null
      ? "Son teklif tarihi bilinmiyor"
      : signals.daysToDeadline < 0
      ? "Son teklif tarihi GEÇMİŞ"
      : `Son teklife ${signals.daysToDeadline} gün kaldı`;

  const ruleSignalsText = [
    `CPV/sektör eşleşmesi: ${
      signals.cpvProfileEmpty
        ? "Firma profilinde CPV kodu tanımlı değil"
        : `${signals.cpvMatchCount} kod eşleşti`
    }`,
    `Coğrafi: ${geoText}`,
    `Bedel/kapasite: ${valueText}`,
    `Süre: ${deadlineText}`,
    `İhale usulü: ${signals.method}`,
    `İhale durumu: ${signals.statusFlag}`,
  ].join("\n");

  return `Sen deneyimli bir Türk kamu ihalesi uyum analistisin. Aşağıdaki ihaleyi, verilen şirket profili açısından değerlendir ve şeffaf bir "eşleşme anatomisi" üret.

## İhale Bilgileri
${tenderDetails}${aiSummarySection}

## Şirket Profili
${profileDetails}

## Kural-Tabanlı Ön Sinyaller (sistemin otomatik hesabı — bunları doğrula ve gerekçende kullan)
${ruleSignalsText}

## Görev
Altı boyutta ayrı ayrı 0-100 arası alt-puan ver ve her biri için TEK CÜMLELİK somut Türkçe gerekçe yaz. Boyutlar ve sabit ağırlıkları:
1. cpv — Sektör/CPV uyumu (ağırlık 25): faaliyet alanı ve CPV örtüşmesi.
2. experience — İş deneyim yeterliliği (ağırlık 20): firmanın iş deneyim belgesi tutarı/geçmişi vs ihalenin yaklaşık maliyetine göre gereken eşik.
3. financial — Ekonomik/mali kapasite (ağırlık 20): ciro, banka referansı, geçici teminat karşılama gücü vs ihale büyüklüğü.
4. geographic — Coğrafi uygunluk (ağırlık 15): ihale ili firmanın çalışma/tercih bölgesiyle uyumu.
5. timing — Süre uygunluğu (ağırlık 10): son teklif tarihine kalan gün teklif hazırlamaya yeterli mi.
6. method — İhale usulü uyumu (ağırlık 10): ihale usulü firmanın katılabileceği bir usul mü.

Genel skoru bu altı alt-puanın ağırlıklı ortalaması olarak düşün. Ardından kazanılabilirliği tek cümlede özetle, somut artılar/riskleri listele ve teklif verebilmek için firmanın tamamlaması gereken eksikleri (belge, teminat, ortaklık vb.) madde madde yaz.

Yanıtını YALNIZCA aşağıdaki JSON formatında ver, başka hiçbir açıklama/markdown ekleme:
{
  "fitScore": <0-100 arası tamsayı>,
  "winnability": "<tek cümlelik kazanılabilirlik özeti>",
  "reasoning": "<tek paragraf Türkçe genel değerlendirme>",
  "breakdown": [
    { "key": "cpv", "score": <0-100>, "reasoning": "<tek cümle>" },
    { "key": "experience", "score": <0-100>, "reasoning": "<tek cümle>" },
    { "key": "financial", "score": <0-100>, "reasoning": "<tek cümle>" },
    { "key": "geographic", "score": <0-100>, "reasoning": "<tek cümle>" },
    { "key": "timing", "score": <0-100>, "reasoning": "<tek cümle>" },
    { "key": "method", "score": <0-100>, "reasoning": "<tek cümle>" }
  ],
  "pros": ["<somut avantaj>", "..."],
  "risks": ["<somut risk>", "..."],
  "checklist": ["<teklif için tamamlanması gereken madde>", "..."]
}`;
}

function makeBreakdownItem(
  key: BreakdownKey,
  score: number,
  reasoning: string,
): ScoreBreakdownItem {
  return {
    key,
    label: BREAKDOWN_WEIGHTS[key].label,
    weight: BREAKDOWN_WEIGHTS[key].weight,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasoning,
  };
}

/**
 * Rule-based scorer. Produces the full match-anatomy shape (six weighted
 * sub-scores + pros/risks + checklist) so it can serve as a non-degraded
 * fallback when the AI is unavailable or fails after retries.
 */
function computeRuleBasedScore(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
  signals: RuleSignals,
): AiScoreResult {
  const pros: string[] = [];
  const risks: string[] = [];
  const checklist: string[] = [];

  // cpv
  let cpvScore: number;
  let cpvReason: string;
  if (signals.cpvProfileEmpty) {
    cpvScore = 50;
    cpvReason = "Profilde CPV kodu tanımlı olmadığı için sektör uyumu kesinleştirilemedi.";
    checklist.push("Firma profiline faaliyet alanınıza uygun CPV kodlarını ekleyin.");
  } else if (signals.cpvMatchCount > 0) {
    cpvScore = Math.min(100, 60 + signals.cpvMatchCount * 15);
    cpvReason = `${signals.cpvMatchCount} CPV kodu profilinizle örtüşüyor.`;
    pros.push(`${signals.cpvMatchCount} CPV kodu eşleşmesi bulundu`);
  } else {
    cpvScore = 25;
    cpvReason = "İhalenin CPV kodları profilinizle örtüşmüyor.";
    risks.push("CPV kodları profille örtüşmüyor");
  }

  // experience & financial (both keyed off value-vs-ceiling)
  let expScore: number;
  let expReason: string;
  let finScore: number;
  let finReason: string;
  switch (signals.valueVsCeiling) {
    case "under":
      expScore = 85;
      expReason = "İhale bedeli iş deneyim/kapasite limitinizin altında, yeterlik rahat sağlanır.";
      finScore = 80;
      finReason = "İhale büyüklüğü mali kapasitenizle uyumlu görünüyor.";
      pros.push("İhale değeri deneyim limitinizin altında");
      break;
    case "near":
      expScore = 60;
      expReason = "İhale bedeli iş deneyim limitinize yakın, yeterlik sınırda.";
      finScore = 60;
      finReason = "İhale büyüklüğü mali kapasitenizi zorlayabilir.";
      checklist.push("İş deneyim belgenizin ihale eşiğini karşıladığını doğrulayın.");
      break;
    case "over":
      expScore = 30;
      expReason = "İhale bedeli iş deneyim limitinizi belirgin şekilde aşıyor.";
      finScore = 35;
      finReason = "İhale büyüklüğü mali kapasitenizin üzerinde, ortaklık gerekebilir.";
      risks.push("İhale değeri deneyim limitinizi önemli ölçüde aşıyor");
      checklist.push("İş ortaklığı/konsorsiyum ile yeterlik eşiğini karşılamayı değerlendirin.");
      break;
    default:
      expScore = 50;
      expReason = "Yaklaşık maliyet veya deneyim limitiniz bilinmediğinden yeterlik netleşmedi.";
      finScore = 50;
      finReason = "Mali kapasite karşılaştırması için yeterli veri yok.";
      checklist.push("Profilinize yıllık ciro ve iş deneyim tutarınızı girin.");
  }

  // geographic
  let geoScore: number;
  let geoReason: string;
  switch (signals.geoStatus) {
    case "preferred":
      geoScore = 90;
      geoReason = `${tender.il} çalışma/tercih bölgenizde.`;
      pros.push(`${tender.il} tercih edilen bölgede`);
      break;
    case "excluded":
      geoScore = 10;
      geoReason = `${tender.il} hariç tuttuğunuz iller arasında.`;
      risks.push(`${tender.il} hariç tutulan il listesinde`);
      break;
    case "neutral":
      geoScore = 45;
      geoReason = `${tender.il} tercih ettiğiniz bölgelerin dışında.`;
      risks.push(`${tender.il} tercih edilen bölge dışında`);
      break;
    default:
      geoScore = 50;
      geoReason = "İhale ili belirtilmediğinden coğrafi uygunluk değerlendirilemedi.";
  }

  // timing
  let timeScore: number;
  let timeReason: string;
  const d = signals.daysToDeadline;
  if (d == null) {
    timeScore = 50;
    timeReason = "Son teklif tarihi bilinmiyor.";
  } else if (d < 0) {
    timeScore = 0;
    timeReason = "Son teklif tarihi geçmiş.";
    risks.push("Son teklif tarihi geçmiş");
  } else if (d < 3) {
    timeScore = 35;
    timeReason = `Son teklife yalnızca ${d} gün kaldı, hazırlık süresi dar.`;
    risks.push(`Son teklife sadece ${d} gün kaldı`);
  } else if (d <= 10) {
    timeScore = 70;
    timeReason = `Son teklife ${d} gün var, hazırlık için makul süre.`;
  } else {
    timeScore = 90;
    timeReason = `Son teklife ${d} gün var, hazırlık için bol süre.`;
  }

  // method
  const methodScore = signals.statusFlag === "active" ? 75 : 40;
  const methodReason =
    signals.statusFlag === "active"
      ? `${signals.method} usulü aktif ihale; katılıma açık görünüyor.`
      : "İhale aktif durumda olmayabilir, usul uygunluğunu teyit edin.";
  if (signals.statusFlag !== "active") {
    risks.push("İhale iptal edilmiş veya sonuçlanmış olabilir");
  }

  const breakdown: ScoreBreakdownItem[] = [
    makeBreakdownItem("cpv", cpvScore, cpvReason),
    makeBreakdownItem("experience", expScore, expReason),
    makeBreakdownItem("financial", finScore, finReason),
    makeBreakdownItem("geographic", geoScore, geoReason),
    makeBreakdownItem("timing", timeScore, timeReason),
    makeBreakdownItem("method", methodScore, methodReason),
  ];

  const finalScore = weightedFitScore(breakdown);
  const reasoning =
    finalScore >= 75
      ? "Profil kriterleri güçlü bir eşleşme gösteriyor."
      : finalScore >= 50
      ? "Profil kriterleriyle orta düzeyde uyum var."
      : "Bu ihale mevcut profilinizle sınırlı uyum gösteriyor.";
  const winnability =
    finalScore >= 75
      ? "Kazanma şansınız yüksek — öne çıkan bir fırsat."
      : finalScore >= 50
      ? "Değerlendirmeye değer, bazı kriterleri netleştirin."
      : "Kazanma şansı düşük — kaynaklarınızı dikkatli ayırın.";

  return { fitScore: finalScore, winnability, pros, risks, reasoning, breakdown, checklist };
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

/**
 * Robustly extract a JSON object from a model response. Handles markdown code
 * fences and leading/trailing prose by slicing from the first `{` to the last
 * `}`. Throws (rather than returning null) so transient/garbled responses are
 * retried instead of silently degrading.
 */
function extractJsonObject(raw: string): Record<string, unknown> {
  const text = raw.trim();
  // Try direct parse first.
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  // Strip markdown code fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  // Slice from first { to last }.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  }
  throw new Error("No JSON object found in AI response");
}

type RawBreakdown = { key?: unknown; score?: unknown; reasoning?: unknown };

/**
 * Normalise the model's breakdown array into the canonical six-dimension shape,
 * applying fixed labels/weights and falling back to the rule-based sub-scores
 * for any dimension the model omitted or returned malformed.
 */
function normaliseBreakdown(
  raw: unknown,
  ruleBreakdown: ScoreBreakdownItem[],
): ScoreBreakdownItem[] {
  const byKey = new Map<string, RawBreakdown>();
  if (Array.isArray(raw)) {
    for (const item of raw as RawBreakdown[]) {
      if (item && typeof item.key === "string") byKey.set(item.key, item);
    }
  }
  const ruleByKey = new Map(ruleBreakdown.map((b) => [b.key, b]));

  return BREAKDOWN_ORDER.map((key) => {
    const fromAi = byKey.get(key);
    const fallback = ruleByKey.get(key)!;
    const score =
      fromAi && typeof fromAi.score === "number" && Number.isFinite(fromAi.score)
        ? fromAi.score
        : fallback.score;
    const reasoning =
      fromAi && typeof fromAi.reasoning === "string" && fromAi.reasoning.trim().length > 0
        ? fromAi.reasoning.trim()
        : fallback.reasoning;
    return makeBreakdownItem(key, score, reasoning);
  });
}

function toStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => typeof v === "string" && v.trim().length > 0)
    .map((v) => String(v).trim())
    .slice(0, max);
}

async function scoreWithAi(
  tender: typeof tendersTable.$inferSelect,
  profile: typeof companyProfilesTable.$inferSelect,
  signals: RuleSignals,
  ruleScore: AiScoreResult,
): Promise<AiScoreResult> {
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");

  const prompt = buildScoringPrompt(tender, profile, signals);

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3500,
    system:
      "Sen bir Türk kamu ihalesi uyum analistisin. Yalnızca geçerli, eksiksiz JSON döndür; markdown veya açıklama ekleme.",
    messages: [{ role: "user", content: prompt }],
  });

  const firstBlock = response.content[0];
  const content = firstBlock?.type === "text" ? firstBlock.text : null;
  if (!content) throw new Error("Empty AI response");

  // extractJsonObject throws on unparseable/truncated output → retried upstream.
  const parsed = extractJsonObject(content);

  const breakdown = normaliseBreakdown(parsed.breakdown, ruleScore.breakdown);
  // Derive the headline score from the breakdown so the number is always
  // consistent with the visible anatomy (single reliable figure).
  const fitScore = weightedFitScore(breakdown);

  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
      ? parsed.reasoning.trim()
      : ruleScore.reasoning;
  const winnability =
    typeof parsed.winnability === "string" && parsed.winnability.trim().length > 0
      ? parsed.winnability.trim()
      : ruleScore.winnability;

  const pros = toStringArray(parsed.pros, 6);
  const risks = toStringArray(parsed.risks, 6);
  const checklist = toStringArray(parsed.checklist, 8);

  return {
    fitScore,
    reasoning,
    winnability,
    pros: pros.length > 0 ? pros : ruleScore.pros,
    risks: risks.length > 0 ? risks : ruleScore.risks,
    breakdown,
    checklist: checklist.length > 0 ? checklist : ruleScore.checklist,
  };
}

interface ScoringPair {
  tender: typeof tendersTable.$inferSelect;
  profile: typeof companyProfilesTable.$inferSelect;
}

export async function scoreNewTenders(
  newTenderIds: number[],
  opts: { businessId?: string } = {},
): Promise<ScoredMatch[]> {
  if (newTenderIds.length === 0) return [];

  const [tenders, profiles] = await Promise.all([
    db.select().from(tendersTable).where(inArray(tendersTable.id, newTenderIds)),
    opts.businessId
      ? db
          .select()
          .from(companyProfilesTable)
          .where(eq(companyProfilesTable.businessId, opts.businessId))
      : db.select().from(companyProfilesTable),
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
  const preScored = pairs.map((p) => {
    const signals = computeRuleSignals(p.tender, p.profile);
    return {
      ...p,
      signals,
      ruleScore: computeRuleBasedScore(p.tender, p.profile, signals),
    };
  });
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
  // We retry transient AI failures internally (with backoff) rather than
  // silently degrading on the first error. Only after exhausting all attempts
  // do we fall back to the (now full-shape) rule-based score, and that fallback
  // is logged at error level so it is never silent.
  const AI_MAX_ATTEMPTS = 3;
  type PreScoredPair = (typeof aiCandidates)[number];
  const scoredPairs = await batchProcess(
    aiCandidates,
    async ({ tender, profile, signals, ruleScore }: PreScoredPair) => {
      if (!aiEnabled) return { tender, profile, ...ruleScore };

      for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
        try {
          const result = await scoreWithAi(tender, profile, signals, ruleScore);
          logger.debug(
            { tenderId: tender.id, businessId: profile.businessId, fitScore: result.fitScore, attempt },
            "AI scoring succeeded"
          );
          return { tender, profile, ...result };
        } catch (err) {
          if (attempt < AI_MAX_ATTEMPTS) {
            logger.warn(
              { err, tenderId: tender.id, businessId: profile.businessId, attempt },
              "AI scoring attempt failed — retrying"
            );
            await new Promise((r) => setTimeout(r, 600 * attempt));
            continue;
          }
          logger.error(
            { err, tenderId: tender.id, businessId: profile.businessId, attempts: AI_MAX_ATTEMPTS },
            "AI scoring failed after all retries — using rule-based fallback"
          );
          return { tender, profile, ...ruleScore };
        }
      }
      // Unreachable, but satisfies the type checker.
      return { tender, profile, ...ruleScore };
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
    const { tender, profile, fitScore, reasoning, winnability, pros, risks, breakdown, checklist } = item;

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
          .set({ fitScore, reasoning, winnability, pros, risks, breakdown, checklist, status: "new" })
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
            winnability,
            pros,
            risks,
            breakdown,
            checklist,
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
        winnability,
        pros,
        risks,
        breakdown,
        checklist,
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
