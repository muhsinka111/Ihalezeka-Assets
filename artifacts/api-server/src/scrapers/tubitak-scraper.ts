import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const TUBITAK_URLS = [
  "https://www.tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari",
  "https://www.tubitak.gov.tr/tr/destekler/akademik/ulusal-destek-programlari",
  "https://www.tubitak.gov.tr/tr/kurumsal/duyurular",
];

function slugify(text: string): string {
  return `tubitak-${text.trim().toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]+/gi, "-").slice(0, 70)}`;
}

async function scrapeTubitakPage(url: string): Promise<InsertTender[]> {
  let html: string;
  try {
    const res = await axios.get<string>(url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; İhaleZeka/1.0)",
        "Accept": "text/html",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    html = res.data;
  } catch (err) {
    logger.warn({ url, err }, "TÜBİTAK page unreachable");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  const candidateEls = $("article, .program-item, .support-item, .card, li.item, tr");

  candidateEls.each((_i, el) => {
    const el$ = $(el);
    const titleEl = el$.find("h2, h3, h4, a, .title").first();
    const title = titleEl.text().trim();
    if (!title || title.length < 8 || seen.has(title)) return;
    seen.add(title);

    const href = titleEl.attr("href") ?? el$.find("a").first().attr("href") ?? "";
    let sourceUrl = href;
    if (href && !href.startsWith("http")) {
      sourceUrl = `https://www.tubitak.gov.tr${href.startsWith("/") ? "" : "/"}${href}`;
    }
    if (!sourceUrl) sourceUrl = url;

    const descEl = el$.find("p, .desc, .description").first();
    const description = descEl.text().trim().slice(0, 500) || null;

    const dateText = el$.find("time, .date, .deadline").text().trim();
    let deadline: Date | null = null;
    if (dateText) {
      const parsed = new Date(dateText.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));
      if (!isNaN(parsed.getTime())) deadline = parsed;
    }

    tenders.push({
      ikn: slugify(title),
      title,
      agencyName: "TÜBİTAK",
      type: "Araştırma Hibesi",
      method: "Hibe",
      estimatedValue: null,
      deadline,
      cpvCodes: [],
      il: "Ankara",
      status: "active",
      category: "hibe",
      description,
      sourceSystem: "tubitak",
      sourceUrl,
      procurementMethod: "Hibe",
      documents: null,
      rawData: { url, title } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return tenders;
}

export async function runTubitakScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("TÜBİTAK scraper starting");
    const allTenders: InsertTender[] = [];

    for (const url of TUBITAK_URLS) {
      try {
        const tenders = await retry(() => scrapeTubitakPage(url), 2, 2000);
        logger.info({ url, count: tenders.length }, "TÜBİTAK page scraped");
        allTenders.push(...tenders);
      } catch (err) {
        logger.warn({ url, err }, "TÜBİTAK page scrape failed");
      }
    }

    const seen = new Set<string>();
    const unique = allTenders.filter(t => {
      if (seen.has(t.ikn)) return false;
      seen.add(t.ikn);
      return true;
    });

    result.fetched = unique.length;

    for (const tender of unique) {
      try {
        const { inserted, tenderId } = await upsertTender(tender);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert TÜBİTAK grant");
      }
    }

    logger.info(result, "TÜBİTAK scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "TÜBİTAK scraper failed");
  }

  await logScraperRun({
    source: "tubitak",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
