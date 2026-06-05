import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tendersTable, scraperRunsTable } from "@workspace/db";
import type { InsertTender, InsertScraperRun } from "@workspace/db";
import type { EkapTender } from "./ekap-client.js";
import type { IlanAd, IlanAdDetail } from "./ilan-client.js";

export interface ScraperResult {
  fetched: number;
  inserted: number;
  updated: number;
  analyzed?: number;
  newTenderIds?: number[];
  error?: string;
}

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
    sourceUrl: `https://ekapv2.kik.gov.tr/ekap/ihale-detay/${tender.id}`,
    procurementMethod: tender.ihaleUsulAciklama ?? null,
    documents: docs.length > 0 ? docs : null,
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

  const sourceUrl = ad.urlStr
    ? ad.urlStr.startsWith("http")
      ? ad.urlStr
      : `https://www.ilan.gov.tr${ad.urlStr}`
    : `https://www.ilan.gov.tr/ilan/${ad.id}`;

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
    sourceUrl,
    procurementMethod: null,
    documents: null,
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
