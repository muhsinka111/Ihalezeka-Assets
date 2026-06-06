import axios from "axios";
import https from "https";
import crypto from "crypto";
import net from "net";
import dns from "dns/promises";
import { createRequire } from "module";
import type { AiAnalysis, TenderContact, FitVerdict } from "@workspace/db";

const _require = createRequire(import.meta.url);

/**
 * SSRF guard for outbound document downloads.
 *
 * Document URLs originate from external scrapers (EKAP / ilan.gov.tr) and are
 * stored in the DB. If that data is ever poisoned, the byte-proxy endpoints
 * (`/tenders/:id/document*`) could be turned into an SSRF sink. We therefore:
 *  - allow only http/https targets;
 *  - resolve the hostname and reject any private/loopback/link-local IP.
 */
function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

/** Returns true if it is unsafe to fetch the given absolute URL. */
async function isUnsafeFetchTarget(fullUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname;
  // Literal IP host — check directly.
  if (net.isIP(host)) return isPrivateIp(host);
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return true;
    return records.some((r) => isPrivateIp(r.address));
  } catch {
    return true; // resolution failed — treat as unsafe
  }
}

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
export async function fetchDocumentBytes(url: string): Promise<Buffer | null> {
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

  // SSRF guard: refuse non-http(s) targets and any host that resolves to a
  // private/loopback/link-local address.
  if (await isUnsafeFetchTarget(fullUrl)) {
    console.warn(`[document-analyzer] Blocked unsafe fetch target: ${fullUrl}`);
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

export async function extractTextFromDocument(
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

const EXTRACTION_PROMPT = `Sen bir Türk kamu ihalesi uzmanısın. Aşağıdaki ihale belgesi metnini ve (varsa) başvuran firmanın profilini analiz et ve yapılandırılmış bilgi çıkar.

ÖNEMLİ: Tüm çıkarımlar SADECE verilen belge metnine dayanmalı. Belgede olmayan bilgileri UYDURMA; bilgi yoksa null veya boş liste döndür. Eğer belge içeriği indirilemediyse bunu özet ve gerekçede açıkça belirt ve uydurma gereksinim yazma.

Metinden şunları çıkar:
1. Kısa özet (2-3 cümle, Türkçe)
2. Gerekli ciro eşiği (TL cinsinden TAM SAYI, yoksa null — örnek: 5000000)
3. Asgari deneyim yılı (TAM SAYI, yoksa null — örnek: 5)
4. Asgari personel sayısı (TAM SAYI, yoksa null — örnek: 10)
5. Teknik şartnameden önemli gereksinimler (liste, en fazla 8 madde, Türkçe)
6. Değerlendirme kriterleri ağırlıkları (obje: {"Fiyat": 40, "Teknik": 60} formatında, boş olabilir)
7. Yeterlilik kriterleri — SADECE belge metninde açıkça belirtilmiş kriterler (liste: her biri {criterion: string, threshold: string|null} formatında, en fazla 8 madde)
8. Genel uygunluk kararı (fitVerdict): firmanın bu ihaleye girmesi için "uygun" (güçlü uyum), "dikkat" (bazı riskler/eksikler var) veya "uygun_degil" (ciddi engeller var). Firma profili verilmemişse belgenin genel zorluğuna göre değerlendir.
9. Kararın gerekçesi (fitReason): 1-2 cümle, belgeye dayalı Türkçe açıklama.
10. Artılar (pros): firma için olumlu yönler (liste, en fazla 5 madde, Türkçe).
11. Riskler (risks): dikkat edilmesi gereken riskler/zorluklar (liste, en fazla 5 madde, Türkçe).
12. İletişim bilgileri (contact): idarenin adı, açık adresi, telefonu, e-postası ve irtibat kişisi. Belgede yoksa ilgili alan null olsun.

Sadece JSON döndür, başka açıklama ekleme:
{
  "summary": "...",
  "requiredTurnover": null,
  "experienceYears": null,
  "personnelCount": null,
  "technicalSpecs": [],
  "scoringWeights": {},
  "qualificationCriteria": [],
  "fitVerdict": "dikkat",
  "fitReason": "...",
  "pros": [],
  "risks": [],
  "contact": { "authority": null, "address": null, "phone": null, "email": null, "contactPerson": null }
}`;

function normalizeVerdict(v: unknown): FitVerdict | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(/\s+/g, "_");
  if (s.includes("uygun_degil") || s.includes("uygun_değil") || s === "no-go" || s === "nogo") return "uygun_degil";
  if (s === "uygun" || s === "go") return "uygun";
  if (s === "dikkat" || s === "caution") return "dikkat";
  return null;
}

function normalizeContact(c: unknown): TenderContact | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
  const contact: TenderContact = {
    authority: str(o.authority),
    address: str(o.address),
    phone: str(o.phone),
    email: str(o.email),
    contactPerson: str(o.contactPerson),
  };
  const hasAny = Object.values(contact).some((v) => v != null);
  return hasAny ? contact : null;
}

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
    fitVerdict: normalizeVerdict(parsed.fitVerdict),
    fitReason: typeof parsed.fitReason === "string" ? parsed.fitReason : null,
    pros: Array.isArray(parsed.pros) ? parsed.pros.filter((p) => typeof p === "string") : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.filter((r) => typeof r === "string") : [],
    contact: normalizeContact(parsed.contact),
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

/** Result of extracting raw text from a tender's documents. */
export interface ExtractedDocsText {
  /** Concatenated, per-document labelled text (empty string when nothing extractable). */
  text: string;
  docsDownloaded: number;
  docsTotal: number;
}

const MAX_EXTRACT_CHARS = 40_000;

/**
 * Download (with EKAP TLS fallback + cache) and extract text from up to the
 * first few documents of a tender. Shared by analyzeDocuments and the
 * document-chat endpoint so text extraction is consistent and reuses the cache.
 */
export async function extractDocumentsText(
  documents: Array<{ name: string; url: string; type: string }>,
  tenderTitle = "",
): Promise<ExtractedDocsText> {
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
    if (allText.join("\n").length > MAX_EXTRACT_CHARS) break;
  }

  return {
    text: allText.join("\n\n").slice(0, MAX_EXTRACT_CHARS),
    docsDownloaded,
    docsTotal,
  };
}

/** Extends DocumentAnalysisResult with the raw extracted text used for analysis. */
export interface DocumentAnalysisResultWithText extends DocumentAnalysisResult {
  /** Combined extracted document text (for persistence + later document chat). */
  extractedText: string;
}

export async function analyzeDocuments(input: DocumentAnalysisInput): Promise<DocumentAnalysisResultWithText> {
  const { tenderTitle, tenderType, tenderMethod, agencyName, documents } = input;

  const contextPrefix = [
    tenderType && `Tür: ${tenderType}`,
    tenderMethod && `Usul: ${tenderMethod}`,
    agencyName && `İdare: ${agencyName}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const { text: extractedText, docsDownloaded, docsTotal } = await extractDocumentsText(
    documents ?? [],
    tenderTitle,
  );

  const bodyText =
    extractedText.length === 0
      ? (documents?.length ?? 0) === 0
        ? "Bu ihale için doküman URL'si mevcut değil. İhale başlığı ve bilgilere göre genel bir değerlendirme yap."
        : "Bu ihale için doküman içeriği indirilemedi veya okunamadı. İhale başlığı ve bilgilere göre genel bir değerlendirme yap."
      : extractedText;

  const combinedText = contextPrefix ? `${contextPrefix}\n\n${bodyText}` : bodyText;
  const analysis = await analyzeWithAI(combinedText, tenderTitle);
  analysis.docsDownloaded = docsDownloaded;
  analysis.docsTotal = docsTotal;

  return { analysis, docsDownloaded, docsTotal, extractedText };
}

export interface DocumentChatInput {
  tenderTitle: string;
  agencyName?: string;
  /** Already-extracted document text. When empty, the model is told docs are unavailable. */
  docText: string;
  question: string;
  /** Prior turns (most recent last). Optional. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

const DOC_CHAT_SYSTEM = `Sen bir Türk kamu ihalesi uzmanı asistanısın. Kullanıcının sorusunu SADECE aşağıda verilen ihale belgesi metnine dayanarak yanıtla.

Kurallar:
- Yanıtların yalnızca verilen belge metnine dayanmalı. Belgede olmayan bir bilgiyi UYDURMA.
- Cevap belgede yoksa "Bu bilgi mevcut belgelerde bulunamadı." de.
- Belge metni boşsa veya indirilemediyse, belgeye erişilemediğini açıkça belirt.
- Kısa, net ve Türkçe yanıt ver. Mümkünse ilgili tutar/tarih/madde gibi somut bilgileri ver.`;

export async function chatWithDocuments(input: DocumentChatInput): Promise<string> {
  const { tenderTitle, agencyName, docText, question, history } = input;
  const openai = await getOpenAI();

  const trimmedDocs =
    docText && docText.trim().length > 0
      ? docText.slice(0, 24_000)
      : "[Belge metni mevcut değil veya indirilemedi.]";

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: DOC_CHAT_SYSTEM },
    {
      role: "system",
      content: `İhale: ${tenderTitle}${agencyName ? ` — ${agencyName}` : ""}\n\nBelge İçeriği:\n${trimmedDocs}`,
    },
    ...(history ?? []).slice(-6),
    { role: "user", content: question },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 700,
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content?.trim() ?? "Yanıt üretilemedi.";
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
