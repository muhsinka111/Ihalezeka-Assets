import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

interface KitTarget {
  agency: string;
  il: string;
  url: string;
  rowSelector: string;
  titleSelector: string;
  dateSelector: string;
  linkSelector: string;
}

const KIT_TARGETS: KitTarget[] = [
  {
    agency: "TCDD",
    il: "Ankara",
    url: "https://www.tcdd.gov.tr/ihale-ilanlar",
    rowSelector: "table tbody tr, .ihale-item, article",
    titleSelector: "td:first-child a, h3, h4, .title",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "BOTAŞ",
    il: "Ankara",
    url: "https://www.botas.gov.tr/index.php/tr/ihale-ilanlar",
    rowSelector: "table tbody tr, .ihale-item, article, li",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "TPAO",
    il: "Ankara",
    url: "https://www.tpao.gov.tr/ihale-ve-tedarik",
    rowSelector: "table tbody tr, .ihale-item, article, li",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "DHMİ",
    il: "Ankara",
    url: "https://www.dhmi.gov.tr/ihale-ve-satin-almalar/ihaleler",
    rowSelector: "table tbody tr, .ihale-item, article, li",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "PTT",
    il: "Ankara",
    url: "https://www.ptt.gov.tr/TRK/kurumsal/ihale-ve-satin-alma",
    rowSelector: "table tbody tr, .ihale-item, article, li",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
];

function slugify(text: string, prefix: string): string {
  return `${prefix}-${text.trim().toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-").slice(0, 70)}`;
}

async function scrapeKitTarget(target: KitTarget): Promise<InsertTender[]> {
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
    logger.warn({ agency: target.agency, url: target.url, err }, "KİT site unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  $(target.rowSelector).each((_i, el) => {
    const row = $(el);
    const titleEl = row.find(target.titleSelector).first();
    const title = titleEl.text().trim();
    if (!title || title.length < 8) return;
    if (seen.has(title)) return;
    seen.add(title);

    const linkEl = row.find(target.linkSelector).first();
    const href = linkEl.attr("href") ?? "";
    const baseUrl = new URL(target.url);
    let sourceUrl = href;
    if (href && !href.startsWith("http")) {
      sourceUrl = `${baseUrl.protocol}//${baseUrl.host}${href.startsWith("/") ? "" : "/"}${href}`;
    }
    if (!sourceUrl) sourceUrl = target.url;

    const dateText = row.find(target.dateSelector).first().text().trim();
    let deadline = new Date(Date.now() + 30 * 86400_000);
    if (dateText) {
      const parsed = new Date(dateText.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));
      if (!isNaN(parsed.getTime())) deadline = parsed;
    }

    const ikn = slugify(`${target.agency}-${title}`, "kit");

    tenders.push({
      ikn,
      title,
      agencyName: target.agency,
      type: "İhale",
      method: "Bilinmiyor",
      estimatedValue: 0,
      deadline,
      cpvCodes: [],
      il: target.il,
      status: "active",
      category: "ihale",
      sourceSystem: "kit",
      sourceUrl,
      procurementMethod: null,
      documents: null,
      rawData: { agency: target.agency, url: sourceUrl } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return tenders;
}

export async function runKitScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("KİT scraper starting");
    const allTenders: InsertTender[] = [];

    for (const target of KIT_TARGETS) {
      try {
        const tenders = await retry(() => scrapeKitTarget(target), 2, 2000);
        logger.info({ agency: target.agency, count: tenders.length }, "KİT target scraped");
        allTenders.push(...tenders);
      } catch (err) {
        logger.warn({ agency: target.agency, err }, "KİT target scrape failed");
      }
    }

    result.fetched = allTenders.length;

    for (const tender of allTenders) {
      try {
        const { inserted, tenderId } = await upsertTender(tender);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert KİT tender");
      }
    }

    logger.info(result, "KİT scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "KİT scraper failed");
  }

  await logScraperRun({
    source: "kit",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
