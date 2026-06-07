import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

/**
 * Regional Development Agency (Kalkınma Ajansları) scraper.
 *
 * Targets the announcements / support-program pages of four agencies whose
 * sites are confirmed server-rendered (CMS / Drupal / custom PHP).  Content
 * URL patterns differ per agency; each target declares its own Cheerio selector
 * strategy.
 *
 * Agencies that either 404 or are fully JS-rendered are commented out until a
 * working URL is confirmed.
 */

interface KalkinmaTarget {
  agency: string;
  region: string;
  url: string;
  /** CSS selector for anchor tags that link to individual announcement pages */
  linkSelector: string;
  /** Minimum characters for a title to be considered a real tender entry */
  minTitleLen: number;
}

const KALKINMA_TARGETS: KalkinmaTarget[] = [
  {
    agency: "BAKA",
    region: "Batı Akdeniz",
    url: "https://baka.gov.tr/duyurular",
    // BAKA CMS uses /duyuru/<slug> URLs for individual announcements
    linkSelector: "a[href*='/duyuru/']",
    minTitleLen: 8,
  },
  {
    agency: "BEBKA",
    region: "Bursa Eskişehir Bilecik",
    url: "https://bebka.org.tr/proje-ihaleleri/",
    // BEBKA WordPress: post links use /proje-ihaleleri/<post> or /haber/<post>
    linkSelector: "a[href*='/proje-ihaleleri/'], a[href*='/haber/'], .entry-title a, .post-title a, article h2 a, article h3 a",
    minTitleLen: 8,
  },
  {
    agency: "DOGAKA",
    region: "Doğu Akdeniz",
    url: "https://www.dogaka.gov.tr/duyurular",
    // DOGAKA custom CMS: announcements at /duyuru/<id> or /duyurular/<slug>
    linkSelector: "a[href*='/duyuru'], a[href*='/haber'], .duyuru-baslik a, article a, .news-title a",
    minTitleLen: 8,
  },
  {
    agency: "MARKA",
    region: "Kuzey Marmara",
    url: "https://www.marka.org.tr/haberler",
    // MARKA WordPress: post links use /haberler/<slug>
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
    // Skip navigation/menu links (very common short labels)
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

    // Skip if the resolved URL is the same as the listing page (nav loop)
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
      description: [title, `Kurum: ${target.agency} Kalkınma Ajansı (${target.region})`].filter(Boolean).join("\n"),
      sourceSystem: "kalkinma_ajansi",
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
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("Kalkınma Ajansları scraper starting");

    for (const target of KALKINMA_TARGETS) {
      try {
        const tenders = await retry(() => scrapeKalkinmaTarget(target), 2, 2000);
        logger.info({ agency: target.agency, count: tenders.length }, "Kalkınma Ajansı target scraped");
        result.fetched += tenders.length;

        for (const tender of tenders) {
          try {
            const { inserted, tenderId } = await upsertTender(tender);
            if (inserted) {
              result.inserted++;
              result.newTenderIds!.push(tenderId);
            } else {
              result.updated++;
            }
          } catch (err) {
            logger.warn({ ikn: tender.ikn, err }, "Failed to upsert Kalkınma tender");
          }
        }
      } catch (err) {
        logger.warn({ agency: target.agency, err }, "Kalkınma target scrape failed");
      }
    }

    logger.info(result, "Kalkınma Ajansları scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "Kalkınma Ajansları scraper failed");
  }

  await finalizeScraperRun({ source: "kalkinma_ajansi", startedAt, result });
  return result;
}
