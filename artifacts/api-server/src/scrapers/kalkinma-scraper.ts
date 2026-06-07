import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

/**
 * Regional Development Agency (Kalkınma Ajansları) scraper.
 *
 * Each agency has its own sourceSystem key and gets its own scraper_runs row
 * (same pattern as kit-scraper.ts). This lets the admin health view show
 * per-agency status individually.
 *
 * An aggregate "kalkinma_ajansi" scraper_runs row is also written at the end
 * for backward compatibility.
 *
 * Confirmed working agencies (server-rendered CMS/WordPress/Drupal):
 *   baka    — BAKA  (Batı Akdeniz)
 *   bebka   — BEBKA (Bursa Eskişehir Bilecik)
 *   dogaka  — DOGAKA (Doğu Akdeniz)
 *   marka   — MARKA (Kuzey Marmara)
 */

interface KalkinmaTarget {
  agency: string;
  /** sourceSystem key — also used for scraper_runs rows */
  sourceKey: string;
  region: string;
  url: string;
  linkSelector: string;
  minTitleLen: number;
}

const KALKINMA_TARGETS: KalkinmaTarget[] = [
  {
    agency: "BAKA",
    sourceKey: "baka",
    region: "Batı Akdeniz",
    url: "https://baka.gov.tr/duyurular",
    linkSelector: "a[href*='/duyuru/']",
    minTitleLen: 8,
  },
  {
    agency: "BEBKA",
    sourceKey: "bebka",
    region: "Bursa Eskişehir Bilecik",
    url: "https://bebka.org.tr/proje-ihaleleri/",
    linkSelector: "a[href*='/proje-ihaleleri/'], a[href*='/haber/'], .entry-title a, .post-title a, article h2 a, article h3 a",
    minTitleLen: 8,
  },
  {
    agency: "DOGAKA",
    sourceKey: "dogaka",
    region: "Doğu Akdeniz",
    url: "https://www.dogaka.gov.tr/duyurular",
    linkSelector: "a[href*='/duyuru'], a[href*='/haber'], .duyuru-baslik a, article a, .news-title a",
    minTitleLen: 8,
  },
  {
    agency: "MARKA",
    sourceKey: "marka",
    region: "Kuzey Marmara",
    url: "https://www.marka.org.tr/haberler",
    linkSelector: "a[href*='/haberler/'], a[href*='/duyuru/'], .entry-title a, .post-title a, article h2 a",
    minTitleLen: 8,
  },
];

function slugify(agency: string, title: string): string {
  const slug = `${agency}-${title}`.trim().toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-").slice(0, 70);
  return `kalkinma-${slug}`;
}

async function scrapeKalkinmaTarget(target: KalkinmaTarget): Promise<InsertTender[]> {
  let html: string;
  try {
    const res = await axios.get<string>(target.url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; İhaleZeka/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    html = res.data;
  } catch (err) {
    logger.warn({ agency: target.agency, url: target.url, err }, "Kalkınma Ajansı site unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  $(target.linkSelector).each((_i, el) => {
    const anchor = $(el);
    const title = anchor.text().trim().replace(/\s+/g, " ");
    if (!title || title.length < target.minTitleLen) return;
    if (title.length > 200) return;
    if (seen.has(title)) return;
    seen.add(title);

    const href = anchor.attr("href") ?? "";
    let sourceUrl = href;
    if (href && !href.startsWith("http")) {
      const baseUrl = new URL(target.url);
      sourceUrl = `${baseUrl.protocol}//${baseUrl.host}${href.startsWith("/") ? "" : "/"}${href}`;
    }
    if (!sourceUrl) sourceUrl = target.url;

    const normalizeUrl = (u: string) => u.replace(/\/$/, "");
    if (normalizeUrl(sourceUrl) === normalizeUrl(target.url)) return;

    const ikn = slugify(target.agency, title);

    tenders.push({
      ikn,
      title,
      agencyName: `${target.agency} (${target.region} Kalkınma Ajansı)`,
      type: "Destek Programı",
      method: "Başvuru",
      estimatedValue: null,
      deadline: null,
      cpvCodes: [],
      il: target.region.split(" ").pop() ?? "Türkiye",
      status: "active",
      category: "hibe",
      description: [title, `Kurum: ${target.agency} Kalkınma Ajansı (${target.region})`].join("\n"),
      sourceSystem: target.sourceKey,
      sourceUrl,
      procurementMethod: null,
      documents: null,
      rawData: { agency: target.agency, region: target.region, url: sourceUrl } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return tenders;
}

export async function runKalkinmaScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const aggregate: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info("Kalkınma Ajansları scraper starting");

  for (const target of KALKINMA_TARGETS) {
    const agencyStart = new Date();
    const agencyResult: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

    try {
      const tenders = await retry(() => scrapeKalkinmaTarget(target), 2, 2000);
      logger.info({ agency: target.agency, count: tenders.length }, "Kalkınma Ajansı target scraped");
      agencyResult.fetched = tenders.length;

      for (const tender of tenders) {
        try {
          const { inserted, tenderId } = await upsertTender(tender);
          if (inserted) {
            agencyResult.inserted++;
            agencyResult.newTenderIds!.push(tenderId);
          } else {
            agencyResult.updated++;
          }
        } catch (err) {
          logger.warn({ ikn: tender.ikn, err }, "Failed to upsert Kalkınma tender");
        }
      }
    } catch (err) {
      agencyResult.error = String(err);
      logger.warn({ agency: target.agency, err }, "Kalkınma target scrape failed");
    }

    // Write per-agency scraper_runs row
    await finalizeScraperRun({ source: target.sourceKey, startedAt: agencyStart, result: agencyResult });

    // Accumulate into aggregate
    aggregate.fetched += agencyResult.fetched;
    aggregate.inserted += agencyResult.inserted;
    aggregate.updated += agencyResult.updated;
    aggregate.newTenderIds!.push(...(agencyResult.newTenderIds ?? []));
  }

  logger.info(aggregate, "Kalkınma Ajansları scraper completed");

  // Write aggregate scraper_runs row for backward compatibility
  await finalizeScraperRun({ source: "kalkinma_ajansi", startedAt, result: aggregate });
  return aggregate;
}
