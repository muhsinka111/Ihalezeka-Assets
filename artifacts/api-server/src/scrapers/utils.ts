import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { tendersTable, scraperRunsTable } from "@workspace/db";
import type { InsertTender, InsertScraperRun } from "@workspace/db";
import type { EkapTender } from "./ekap-client.js";
import type { IlanAd, IlanAdDetail } from "./ilan-client.js";
import { logger } from "../lib/logger.js";
import { sendEmail, buildSourceHealthEmailHtml } from "../lib/emailService.js";
import { stripHtml } from "../services/document-analyzer.js";
import { deriveContact } from "../lib/contact.js";

export interface ScraperResult {
  fetched: number;
  inserted: number;
  updated: number;
  analyzed?: number;
  newTenderIds?: number[];
  error?: string;
}

/**
 * Health outcome of a single scraper run.
 * - "success"  — fetched at least one record without error.
 * - "empty"    — ran without throwing but fetched 0 records (a silent failure).
 * - "error"    — threw / failed during the run.
 * - "disabled" — source intentionally skipped (missing API key / no stable source).
 */
export type ScraperRunStatus = "success" | "empty" | "error" | "disabled";

/** Human-friendly source names used in admin views and operator alert emails. */
export const SOURCE_LABELS: Record<string, string> = {
  ekap: "EKAP",
  ilan_gov: "ilan.gov.tr",
  ted: "TED (AB İhaleleri)",
  worldbank: "Dünya Bankası",
  ebrd: "EBRD",
  // KİT public enterprises — each tracked individually in scraper_runs
  kit: "KİT (Genel)",
  tcdd: "TCDD",
  botas: "BOTAŞ",
  tpao: "TPAO",
  dhmi: "DHMİ",
  toki: "TOKİ",
  dsi: "DSİ",
  // Grant & support programmes
  tubitak: "TÜBİTAK",
  kosgeb: "KOSGEB",
  kalkinma_ajansi: "Kalkınma Ajansları (toplam)",
  // Kalkınma Ajansları — per-agency keys (each gets its own scraper_runs row)
  baka: "BAKA (Batı Akdeniz Kalkınma Ajansı)",
  bebka: "BEBKA (Bursa Eskişehir Bilecik Kalkınma Ajansı)",
  dogaka: "DOGAKA (Doğu Akdeniz Kalkınma Ajansı)",
  marka: "MARKA (Kuzey Marmara Kalkınma Ajansı)",
  // International sources
  ungm: "BM Tedarik Bildirimleri (UNGM/UNDP)",
  adb: "ADB (Asya Kalkınma Bankası)",
  aiib: "AIIB (Asya Altyapı Yatırım Bankası)",
  isdb: "IsDB (İslam Kalkınma Bankası)",
};

export function parseTurkishDate(str: string): Date {
  if (!str) return new Date();
  const cleaned = str.trim();
  // "DD.MM.YYYY HH:MM" format
  const match = cleaned.match(
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    return new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second ?? "00"}+03:00`,
    );
  }
  const isoAttempt = new Date(str);
  if (!isNaN(isoAttempt.getTime())) return isoAttempt;
  return new Date();
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLocaleLowerCase("tr")
    .replace(/(^|[\s\-])(\S)/gu, (_, sep: string, char: string) => sep + char.toLocaleUpperCase("tr"));
}

/**
 * Parse a Turkish-formatted monetary amount out of free text. Honest by design:
 * returns a number only when a plausible amount is found near a money keyword
 * or an explicit currency marker (TL / ₺ / TRY). Returns null otherwise so the
 * record is marked "value unknown" instead of a fabricated 0.
 */
export function parseTurkishCurrency(text: string | undefined | null): number | null {
  if (!text) return null;

  // Turkish numbers: thousands separated by "." and decimals by ",".
  // e.g. "1.234.567,89 TL" or "5.000.000 ₺".
  const amountPattern =
    /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:tl|try|₺|türk lirası)/giu;

  const candidates: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = amountPattern.exec(text)) !== null) {
    const raw = m[1].replace(/\./g, "").replace(",", ".");
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) candidates.push(n);
  }

  if (candidates.length === 0) return null;
  // The estimated/contract value is typically the largest figure quoted.
  return Math.max(...candidates);
}

/**
 * Try to extract a real deadline date from ad detail text. Returns null when no
 * confident date can be found (so we never fabricate one).
 */
export function parseDeadlineFromText(text: string | undefined | null): Date | null {
  if (!text) return null;

  // Look for a Turkish date near a deadline keyword.
  const keyword =
    /(son\s+başvuru|son\s+teklif|ihale\s+tarihi|son\s+müracaat|teklif\s+verme|açık\s+eksiltme)/iu;
  const idx = text.search(keyword);
  const scope = idx >= 0 ? text.slice(idx, idx + 120) : text;

  const dateMatch = scope.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!dateMatch) return null;

  const [, day, month, year, hour, minute] = dateMatch;
  const d = new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${(hour ?? "00").padStart(2, "0")}:${minute ?? "00"}:00+03:00`,
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Extract CPV codes from a loosely-typed source payload, where exposed. */
function extractCpvCodes(raw: Record<string, unknown>): string[] {
  const candidateKeys = ["cpvKodlari", "cpvKodu", "cpvList", "cpvCodes", "cpv"];
  for (const key of candidateKeys) {
    const val = raw[key];
    if (Array.isArray(val)) {
      const codes = val
        .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? String((v as any).kod ?? (v as any).code ?? "") : String(v)))
        .map((s) => s.trim())
        .filter(Boolean);
      if (codes.length > 0) return codes;
    } else if (typeof val === "string" && val.trim()) {
      return val.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function mapEkapToTender(tender: EkapTender): InsertTender {
  const deadline = parseTurkishDate(tender.ihaleTarihSaat);

  const docs = (tender.dokumanListe ?? []).map((d) => ({
    name: d.adi ?? "",
    url: d.url ?? "",
    type: d.tur ?? "",
  }));

  const raw = tender as unknown as Record<string, unknown>;
  // For live EKAP tenders the estimated cost ("yaklaşık maliyet") is confidential
  // by law until bid opening, so it is genuinely not published. Use the contract /
  // awarded value where the payload exposes it; otherwise leave it null
  // ("Belirtilmemiş") rather than fabricating a 0.
  const ekapValueKeys = ["sozlesmeBedeli", "ihaleBedeli", "yaklasikMaliyet", "bedel"];
  let estimatedValue: number | null = null;
  for (const k of ekapValueKeys) {
    const v = raw[k];
    if (typeof v === "number" && v > 0) { estimatedValue = v; break; }
    if (typeof v === "string") {
      const parsed = parseTurkishCurrency(v) ?? Number(v.replace(/[^0-9.]/g, ""));
      if (parsed && parsed > 0) { estimatedValue = parsed; break; }
    }
  }

  return {
    ikn: tender.ikn || `ekap-${tender.id}`,
    title: tender.ihaleAdi ?? "",
    agencyName: tender.idareAdi ?? "",
    type: tender.ihaleTipAciklama ?? tender.ihaleTip ?? "Bilinmiyor",
    method: tender.ihaleUsulAciklama ?? "",
    estimatedValue,
    deadline,
    cpvCodes: extractCpvCodes(raw),
    il: toTitleCase(tender.ihaleIlAdi ?? ""),
    status: mapEkapStatus(tender.ihaleDurum, tender.ihaleDurumAciklama),
    sourceSystem: "ekap",
    category: "ihale",
    sourceUrl: tender.ikn
      ? `https://ekapv2.kik.gov.tr/ekap/detay/${tender.ikn}`
      : `https://ekapv2.kik.gov.tr/ekap/ihale-detay/${tender.id}`,
    procurementMethod: tender.ihaleUsulAciklama ?? null,
    documents: docs.length > 0 ? docs : null,
    contact: deriveContact({ agencyName: tender.idareAdi, rawData: raw }),
    rawData: tender as unknown as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

function mapEkapStatus(
  durum: string | undefined,
  durumAciklama: string | undefined,
): string {
  const d = (durum ?? durumAciklama ?? "").toLowerCase();
  if (d.includes("iptal")) return "cancelled";
  if (d.includes("sonuç") || d.includes("ihale yapıldı") || d.includes("tamamlandı")) return "awarded";
  return "active";
}

/**
 * İlan.gov ad details expose attachments via a `files` array. In practice this
 * is null/empty for the listing types we ingest (verified across all stored ads
 * and a live GetAdDetail call), so today it yields nothing — but we extract
 * defensively so any ad that DOES carry downloadable files is captured at
 * ingest. Only genuine URLs are kept; nothing is fabricated.
 */
function extractIlanDocuments(
  ad: Record<string, unknown>,
): Array<{ name: string; url: string; type: string }> {
  const files = ad.files;
  if (!Array.isArray(files)) return [];
  const docs: Array<{ name: string; url: string; type: string }> = [];
  for (const f of files) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const urlRaw = [o.url, o.fileUrl, o.path, o.link, o.downloadUrl, o.src].find(
      (v) => typeof v === "string" && v.trim().length > 0,
    ) as string | undefined;
    if (!urlRaw) continue;
    const url = urlRaw.startsWith("http")
      ? urlRaw
      : `https://www.ilan.gov.tr${urlRaw.startsWith("/") ? "" : "/"}${urlRaw}`;
    const name =
      ([o.name, o.fileName, o.title, o.fileNameWithExtension].find(
        (v) => typeof v === "string" && (v as string).trim().length > 0,
      ) as string | undefined) ?? "İlan Eki";
    docs.push({ name, url, type: "ilan-belge" });
  }
  return docs;
}

export function mapIlanToTender(ad: IlanAd | IlanAdDetail): InsertTender {
  const detail = ad as IlanAdDetail;

  // Honest deadline: parse a real date from the ad detail text, else fall back to
  // the ad's publish end date, else mark unknown (null). Never fabricate +30 days.
  let deadline: Date | null = parseDeadlineFromText(detail.text);
  if (!deadline && detail.publishEndDate) {
    const d = new Date(detail.publishEndDate);
    if (!isNaN(d.getTime())) deadline = d;
  }

  // Real ad category when the detail exposes it; otherwise a generic, honest label
  // instead of a hardcoded constant.
  const type = detail.categoryName?.trim() || ad.adSourceName?.trim() || "İlan";

  // Value parsed from the ad text where present; null otherwise.
  const estimatedValue = parseTurkishCurrency(detail.text);

  // Plain-text notice body for grounding/search: the ilan detail HTML lives in
  // `content`; fall back to the (already-plain) `text` field.
  const rawContent =
    typeof (ad as unknown as { content?: unknown }).content === "string"
      ? ((ad as unknown as { content: string }).content)
      : "";
  const description =
    (rawContent ? stripHtml(rawContent) : (detail.text ?? "").trim()) || null;

  const sourceUrl = ad.urlStr
    ? ad.urlStr.startsWith("http")
      ? ad.urlStr
      : `https://www.ilan.gov.tr${ad.urlStr}`
    : `https://www.ilan.gov.tr/ilan/${ad.id}`;

  const documents = extractIlanDocuments(ad as unknown as Record<string, unknown>);

  return {
    ikn: `ilan-${ad.adNo || ad.id}`,
    title: ad.title ?? "",
    agencyName: ad.advertiserName ?? "",
    type,
    method: ad.adSourceName ?? "Bilinmiyor",
    estimatedValue,
    deadline,
    cpvCodes: [],
    il: ad.addressCityName ?? "",
    status: "active",
    sourceSystem: "ilan_gov",
    category: "ihale",
    description,
    sourceUrl,
    procurementMethod: null,
    documents: documents.length > 0 ? documents : null,
    contact: deriveContact({
      agencyName: ad.advertiserName,
      description,
      rawData: ad as unknown as Record<string, unknown>,
    }),
    rawData: ad as unknown as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function upsertTender(
  tender: InsertTender,
): Promise<{ inserted: boolean; tenderId: number }> {
  const existing = await db
    .select({ id: tendersTable.id })
    .from(tendersTable)
    .where(eq(tendersTable.ikn, tender.ikn))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(tendersTable)
      .set({ ...tender, updatedAt: new Date() })
      .where(eq(tendersTable.ikn, tender.ikn));
    return { inserted: false, tenderId: existing[0].id };
  } else {
    const [inserted] = await db.insert(tendersTable).values(tender).returning({ id: tendersTable.id });
    return { inserted: true, tenderId: inserted.id };
  }
}

export async function logScraperRun(run: InsertScraperRun): Promise<string> {
  const [row] = await db.insert(scraperRunsTable).values(run).returning({ id: scraperRunsTable.id });
  return row.id;
}

export async function updateScraperRunAnalyzed(id: string, recordsAnalyzed: number): Promise<void> {
  await db.update(scraperRunsTable).set({ recordsAnalyzed }).where(eq(scraperRunsTable.id, id));
}

/** Derive a run's health status from its result and disabled flag. */
function deriveRunStatus(result: ScraperResult, disabled?: boolean): ScraperRunStatus {
  if (disabled) return "disabled";
  if (result.error) return "error";
  if (result.fetched === 0) return "empty";
  return "success";
}

/**
 * Persist a scraper run with a computed health status and raise an operator
 * alert when a previously-healthy source breaks or goes empty.
 *
 * This is the single chokepoint every scraper should use so that a 0-record or
 * errored run is never silently recorded as a success. Returns the run id so
 * callers (e.g. EKAP) can patch in the analyzed count afterwards.
 */
export async function finalizeScraperRun(params: {
  source: string;
  startedAt: Date;
  result: ScraperResult;
  /** Mark the source as intentionally skipped (not a failure). */
  disabled?: boolean;
  /** Human-readable reason recorded when disabled or when an empty run occurs. */
  reason?: string;
}): Promise<string> {
  const { source, startedAt, result, disabled, reason } = params;
  const status = deriveRunStatus(result, disabled);

  let errorMessage: string | null = result.error ?? null;
  if (!errorMessage && (status === "disabled" || status === "empty")) {
    errorMessage =
      reason ??
      (status === "disabled"
        ? "Kaynak devre dışı"
        : "Çalıştı ancak 0 kayıt döndürdü (sessiz hata)");
  }

  // Look at the previous run to detect a working -> broken transition.
  let priorStatus: ScraperRunStatus | undefined;
  try {
    const prior = await db
      .select({ status: scraperRunsTable.status })
      .from(scraperRunsTable)
      .where(eq(scraperRunsTable.source, source))
      .orderBy(desc(scraperRunsTable.completedAt))
      .limit(1);
    priorStatus = prior[0]?.status as ScraperRunStatus | undefined;
  } catch (err) {
    logger.warn({ err, source }, "Could not read prior scraper run status");
  }

  const [row] = await db
    .insert(scraperRunsTable)
    .values({
      source,
      startedAt,
      completedAt: new Date(),
      recordsFetched: result.fetched,
      recordsInserted: result.inserted,
      recordsUpdated: result.updated,
      errorMessage,
      status,
    })
    .returning({ id: scraperRunsTable.id });

  // Alert only on the transition from healthy to broken so we never spam the
  // operator on every cron tick while a source stays down. Intentional disables
  // never alert.
  if (priorStatus === "success" && (status === "error" || status === "empty")) {
    void sendSourceHealthAlert({
      source,
      status,
      errorMessage,
      recordsFetched: result.fetched,
    }).catch((err) =>
      logger.error({ err, source }, "Failed to send source-health alert email"),
    );
  }

  return row.id;
}

/** Email the operator that a previously-working source has broken or gone empty. */
async function sendSourceHealthAlert(opts: {
  source: string;
  status: "error" | "empty";
  errorMessage: string | null;
  recordsFetched: number;
}): Promise<void> {
  const to = process.env.OPERATOR_EMAIL ?? process.env.ADMIN_EMAIL ?? null;
  const label = SOURCE_LABELS[opts.source] ?? opts.source;

  if (!to) {
    logger.warn(
      { source: opts.source, status: opts.status },
      "Source broke but no OPERATOR_EMAIL/ADMIN_EMAIL configured — alert email skipped",
    );
    return;
  }

  const subject =
    opts.status === "error"
      ? `İhaleZeka uyarısı: ${label} kaynağında hata`
      : `İhaleZeka uyarısı: ${label} kaynağı 0 kayıt döndürdü`;

  const html = buildSourceHealthEmailHtml({
    sourceLabel: label,
    status: opts.status,
    errorMessage: opts.errorMessage,
    recordsFetched: opts.recordsFetched,
  });

  const sent = await sendEmail({ to, subject, html });
  if (sent) {
    logger.info({ source: opts.source, to }, "Source-health alert email sent");
  }
}
