import axios from "axios";
import https from "https";
import crypto from "crypto";
import { createRequire } from "module";
import type { AiAnalysis } from "@workspace/db";

const _require = createRequire(import.meta.url);

const EKAP_BASE = "https://ekapv2.kik.gov.tr";
const AES_KEY = Buffer.from("Qm2LtXR0aByP69vZNKef4wMJ");

/**
 * EKAP (ekapv2.kik.gov.tr) presents a certificate that does not pass Node.js
 * TLS validation (government CA not in the trust store). This matches the
 * existing pattern in ekap-client.ts for API calls to the same host.
 *
 * Security controls:
 *  - The relaxed agent is ONLY used after a strict-TLS attempt fails AND the
 *    hostname matches EKAP_HOSTNAME_RE (*.kik.gov.tr).
 *  - All non-EKAP URLs always use the strict agent.
 *  - Document content is validated by the AI model, not executed.
 */
const EKAP_HOSTNAME_RE = /^ekapv2?\.kik\.gov\.tr$/i;

const EKAP_TLS_ERRORS = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);

const strictAgent = new https.Agent({ rejectUnauthorized: true });
const ekapFallbackAgent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: "TLSv1.2",
});

// ── In-process download cache ──────────────────────────────────────
// Keyed by normalised URL; lives for the lifetime of the process.
// Avoids re-fetching the same document on re-analyze calls.
const downloadCache = new Map<string, Buffer>();

const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_DOWNLOAD_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500; // 500 ms → 1 000 ms → 2 000 ms

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function aesCbcEncrypt(plaintext: string, key: Buffer, iv: Buffer): string {
  const cipher = crypto.createCipheriv("aes-192-cbc", key, iv);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
}

function generateSecurityHeaders(): Record<string, string> {
  const guid = crypto.randomUUID();
  const iv = crypto.randomBytes(16);
  const tsMs = String(Date.now());
  return {
    "X-Custom-Request-Guid": guid,
    "X-Custom-Request-Siv": iv.toString("base64"),
    "X-Custom-Request-Ts": aesCbcEncrypt(tsMs, AES_KEY, iv),
    "X-Custom-Request-R8id": aesCbcEncrypt(guid, AES_KEY, iv),
  };
}

/** Single HTTP attempt — returns Buffer on success, throws on failure. */
async function attemptDownload(fullUrl: string, isEkap: boolean): Promise<Buffer> {
  const headers = {
    ...generateSecurityHeaders(),
    Accept: "*/*",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    Referer: `${EKAP_BASE}/ekap/search`,
    Origin: EKAP_BASE,
  };

  try {
    const res = await axios.get(fullUrl, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      httpsAgent: strictAgent,
      headers,
    });
    return Buffer.from(res.data);
  } catch (strictErr: any) {
    // For EKAP hosts only: fall back to relaxed TLS when the government CA is
    // not trusted — this mirrors the same pattern in ekap-client.ts.
    if (isEkap && EKAP_TLS_ERRORS.has(strictErr?.code)) {
      const res = await axios.get(fullUrl, {
        responseType: "arraybuffer",
        timeout: DOWNLOAD_TIMEOUT_MS,
        httpsAgent: ekapFallbackAgent,
        headers,
      });
      return Buffer.from(res.data);
    }
    throw strictErr;
  }
}

/**
 * Fetch document bytes with:
 *  - up to MAX_DOWNLOAD_ATTEMPTS retries with exponential back-off
 *  - per-attempt error logging
 *  - in-process cache: successful buffers are stored for the process lifetime
 *    so re-analyze calls skip the network entirely.
 *
 * Returns null if all attempts fail.
 */
async function fetchDocumentBytes(url: string): Promise<Buffer | null> {
  const fullUrl = url.startsWith("http") ? url : `${EKAP_BASE}${url}`;
  const cacheKey = fullUrl;

  // Cache hit — no network round-trip needed.
  const cached = downloadCache.get(cacheKey);
  if (cached) return cached;

  let hostname: string;
  try {
    hostname = new URL(fullUrl).hostname;
  } catch {
    console.warn(`[document-analyzer] Invalid URL, skipping: ${url}`);
    return null;
  }

  const isEkap = EKAP_HOSTNAME_RE.test(hostname);

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const buffer = await attemptDownload(fullUrl, isEkap);
      if (buffer.length === 0) {
        console.warn(
          `[document-analyzer] Empty response on attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS}: ${fullUrl}`,
        );
        // Treat empty body as a retriable failure.
        throw new Error("empty-response");
      }
      // Cache and return on success.
      downloadCache.set(cacheKey, buffer);
      return buffer;
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "unknown";
      const isLast = attempt === MAX_DOWNLOAD_ATTEMPTS;
      console.warn(
        `[document-analyzer] Download ${isLast ? "FAILED" : "error"} (attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS}, code=${code}): ${fullUrl}`,
      );
      if (isLast) return null;
      // Exponential back-off: 500 ms, 1 000 ms, …
      await sleep(BACKOFF_BASE_MS * attempt);
    }
  }

  return null; // unreachable, but satisfies TypeScript
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = _require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text ?? "";
  } catch {
    return "";
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> } =
      _require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  } catch {
    return "";
  }
}

async function extractTextFromDocument(
  buffer: Buffer,
  docType: string,
  docName: string,
): Promise<string> {
  const hint = (docType + " " + docName).toLowerCase();
  if (hint.includes("pdf")) return extractTextFromPdf(buffer);
  if (hint.includes("docx") || hint.includes("doc") || hint.includes("word"))
    return extractTextFromDocx(buffer);
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 50_000));
  const printableRatio =
    text.replace(/[^\x20-\x7E\u00C0-\u024F\s]/g, "").length / Math.max(text.length, 1);
  if (printableRatio > 0.5) return text;
  return extractTextFromPdf(buffer);
}

async function getOpenAI() {
  const { openai } = await import("@workspace/integrations-openai-ai-server");
  return openai;
}

const EXTRACTION_PROMPT = `Sen bir Türk kamu ihalesi uzmanısın. Aşağıdaki ihale belgesi metnini analiz et ve yapılandırılmış bilgi çıkar.

Metinden şunları çıkar:
1. Kısa özet (2-3 cümle, Türkçe)
2. Gerekli ciro eşiği (TL cinsinden TAM SAYI, yoksa null — örnek: 5000000)
3. Asgari deneyim yılı (TAM SAYI, yoksa null — örnek: 5)
4. Asgari personel sayısı (TAM SAYI, yoksa null — örnek: 10)
5. Teknik şartnameden önemli gereksinimler (liste, en fazla 8 madde, Türkçe)
6. Değerlendirme kriterleri ağırlıkları (obje: {"Fiyat": 40, "Teknik": 60} formatında, boş olabilir)
7. Yeterlilik kriterleri — SADECE belge metninde açıkça belirtilmiş kriterler (liste: her biri {criterion: string, threshold: string|null} formatında, en fazla 8 madde)

Sadece JSON döndür, başka açıklama ekleme:
{
  "summary": "...",
  "requiredTurnover": null,
  "experienceYears": null,
  "personnelCount": null,
  "technicalSpecs": [],
  "scoringWeights": {},
  "qualificationCriteria": []
}`;

async function analyzeWithAI(textContent: string, tenderTitle: string): Promise<AiAnalysis> {
  const openai = await getOpenAI();
  const maxChars = 12_000;
  const truncated =
    textContent.length > maxChars
      ? textContent.slice(0, maxChars) + "\n\n[Metin kesildi — belge çok uzun]"
      : textContent;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `İhale Adı: ${tenderTitle}\n\nBelge İçeriği:\n${truncated}` },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<AiAnalysis> = {};
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    parsed = {};
  }

  return {
    summary: parsed.summary ?? "Belge analizi tamamlandı.",
    requiredTurnover: typeof parsed.requiredTurnover === "number" ? parsed.requiredTurnover : null,
    experienceYears: typeof parsed.experienceYears === "number" ? parsed.experienceYears : null,
    personnelCount: typeof parsed.personnelCount === "number" ? parsed.personnelCount : null,
    technicalSpecs: Array.isArray(parsed.technicalSpecs) ? parsed.technicalSpecs : [],
    scoringWeights:
      parsed.scoringWeights && typeof parsed.scoringWeights === "object"
        ? (parsed.scoringWeights as Record<string, number>)
        : {},
    qualificationCriteria: Array.isArray(parsed.qualificationCriteria)
      ? parsed.qualificationCriteria
      : [],
    analyzedAt: new Date().toISOString(),
  };
}

export interface DocumentAnalysisInput {
  tenderTitle: string;
  tenderType?: string;
  tenderMethod?: string;
  agencyName?: string;
  documents: Array<{ name: string; url: string; type: string }>;
}

/** Result type returned by analyzeDocuments — extends AiAnalysis with coverage stats. */
export interface DocumentAnalysisResult {
  analysis: AiAnalysis;
  /** Number of documents successfully downloaded and parsed. */
  docsDownloaded: number;
  /** Total number of document URLs provided (including ones that failed). */
  docsTotal: number;
}

export async function analyzeDocuments(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult> {
  const { tenderTitle, tenderType, tenderMethod, agencyName, documents } = input;

  const contextPrefix = [
    tenderType && `Tür: ${tenderType}`,
    tenderMethod && `Usul: ${tenderMethod}`,
    agencyName && `İdare: ${agencyName}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const docsToFetch = (documents ?? []).filter((d) => !!d.url).slice(0, 3);
  const docsTotal = docsToFetch.length;
  let docsDownloaded = 0;

  const allText: string[] = [];

  for (const doc of docsToFetch) {
    const buffer = await fetchDocumentBytes(doc.url);
    if (!buffer || buffer.length === 0) {
      console.warn(
        `[document-analyzer] Skipping doc after all retries — tender="${tenderTitle}" doc="${doc.name}"`,
      );
      continue;
    }

    const text = await extractTextFromDocument(buffer, doc.type ?? "", doc.name ?? "");
    if (text.trim().length > 50) {
      docsDownloaded++;
      allText.push(`=== ${doc.name} ===\n${text.trim()}`);
    } else {
      console.warn(
        `[document-analyzer] Doc downloaded but no extractable text — tender="${tenderTitle}" doc="${doc.name}"`,
      );
    }
    if (allText.join("\n").length > 15_000) break;
  }

  const bodyText =
    allText.length === 0
      ? documents.length === 0
        ? "Bu ihale için doküman URL'si mevcut değil. İhale başlığı ve bilgilere göre genel bir değerlendirme yap."
        : "Bu ihale için doküman içeriği indirilemedi veya okunamadı. İhale başlığı ve bilgilere göre genel bir değerlendirme yap."
      : allText.join("\n\n");

  const combinedText = contextPrefix ? `${contextPrefix}\n\n${bodyText}` : bodyText;
  const analysis = await analyzeWithAI(combinedText, tenderTitle);

  return { analysis, docsDownloaded, docsTotal };
}

export interface CriteriaComplianceItem {
  criterion: string;
  /**
   * true  — company meets the threshold
   * false — company does NOT meet the threshold
   * null  — cannot determine (company data missing, or no numeric threshold)
   */
  compliant: boolean | null;
  note: string | null;
}

export interface CompanySnapshot {
  annualRevenue?: number | null;
  experienceCeiling?: number | null;
  personnelCount?: number | null;
}

export function computeCriteriaCompliance(
  aiAnalysis: AiAnalysis,
  company: CompanySnapshot,
): CriteriaComplianceItem[] {
  const results: CriteriaComplianceItem[] = [];

  if (aiAnalysis.requiredTurnover != null) {
    const has = company.annualRevenue != null;
    results.push({
      criterion: "Ciro Yeterliliği",
      compliant: has ? company.annualRevenue! >= aiAnalysis.requiredTurnover : null,
      note: `Gerekli: ₺${aiAnalysis.requiredTurnover.toLocaleString("tr-TR")}${has ? ` / Firmanız: ₺${company.annualRevenue!.toLocaleString("tr-TR")}` : " — Firma cirosu profilde girilmemiş"}`,
    });
  }

  if (aiAnalysis.experienceYears != null) {
    const has = company.experienceCeiling != null;
    results.push({
      criterion: "Deneyim Yeterliliği",
      compliant: has ? company.experienceCeiling! >= aiAnalysis.experienceYears : null,
      note: `Gerekli: ${aiAnalysis.experienceYears} yıl${has ? ` / Firmanız: ${company.experienceCeiling} yıl` : " — Deneyim profilde girilmemiş"}`,
    });
  }

  if (aiAnalysis.personnelCount != null) {
    const has = company.personnelCount != null;
    results.push({
      criterion: "Personel Sayısı",
      compliant: has ? company.personnelCount! >= aiAnalysis.personnelCount : null,
      note: `Gerekli: ${aiAnalysis.personnelCount} kişi${has ? ` / Firmanız: ${company.personnelCount} kişi` : " — Personel sayısı profilde girilmemiş"}`,
    });
  }

  for (const c of aiAnalysis.qualificationCriteria ?? []) {
    results.push({
      criterion: c.criterion,
      compliant: null,
      note: c.threshold
        ? `Eşik: ${c.threshold} — Profil karşılaştırması için şirket profilinizi doldurun`
        : "Uyum için şirket profilinizi doldurun",
    });
  }

  return results;
}
