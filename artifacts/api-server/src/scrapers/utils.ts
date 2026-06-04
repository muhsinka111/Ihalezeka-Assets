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

export function mapEkapToTender(tender: EkapTender): InsertTender {
  const deadline = parseTurkishDate(tender.ihaleTarihSaat);

  const docs = (tender.dokumanListe ?? []).map((d) => ({
    name: d.adi ?? "",
    url: d.url ?? "",
    type: d.tur ?? "",
  }));

  return {
    ikn: tender.ikn || `ekap-${tender.id}`,
    title: tender.ihaleAdi ?? "",
    agencyName: tender.idareAdi ?? "",
    type: tender.ihaleTipAciklama ?? tender.ihaleTip ?? "Bilinmiyor",
    method: tender.ihaleUsulAciklama ?? "",
    estimatedValue: 0,
    deadline,
    cpvCodes: [],
    il: tender.ihaleIlAdi ?? "",
    status: mapEkapStatus(tender.ihaleDurum, tender.ihaleDurumAciklama),
    sourceSystem: "ekap",
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
  // Deadline: publishStartDate + 30 days (ilan.gov.tr doesn't provide deadline)
  const pubDate = ad.publishStartDate ? new Date(ad.publishStartDate) : new Date();
  const deadline = new Date(pubDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const sourceUrl = ad.urlStr
    ? ad.urlStr.startsWith("http")
      ? ad.urlStr
      : `https://www.ilan.gov.tr${ad.urlStr}`
    : `https://www.ilan.gov.tr/ilan/${ad.id}`;

  return {
    ikn: `ilan-${ad.adNo || ad.id}`,
    title: ad.title ?? "",
    agencyName: ad.advertiserName ?? "",
    type: "İhale",
    method: ad.adSourceName ?? "Bilinmiyor",
    estimatedValue: 0,
    deadline,
    cpvCodes: [],
    il: ad.addressCityName ?? "",
    status: "active",
    sourceSystem: "ilan_gov",
    sourceUrl,
    procurementMethod: null,
    documents: null,
    rawData: ad as unknown as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function upsertTender(
  tender: InsertTender,
): Promise<{ inserted: boolean }> {
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
    return { inserted: false };
  } else {
    await db.insert(tendersTable).values(tender);
    return { inserted: true };
  }
}

export async function logScraperRun(run: InsertScraperRun): Promise<void> {
  await db.insert(scraperRunsTable).values(run);
}
