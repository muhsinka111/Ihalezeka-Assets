import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BASE_URL = "https://www.kosgeb.gov.tr";
const LIST_URL = `${BASE_URL}/site/tr/genel/destekler/0/tum-destekler`;

function slugify(text: string): string {
  return `kosgeb-${text
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9ğüşıöç]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)}`;
}

async function scrapeKosgbPage(pageNum: number): Promise<InsertTender[]> {
  const url = `${LIST_URL}?Page=${pageNum}`;
  let html: string;
  try {
    const res = await axios.get<string>(url, {
      timeout: 30000,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    html = res.data;
  } catch (err) {
    logger.warn({ url, err }, "KOSGEB page unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  // KOSGEB's support programs are rendered in a grid of
  // div.col-lg-6.col-md-6.col-sm-6.col-xs-12 cards.
  // Each card has a .desc div containing the program title
  // and an <a href="/site/tr/genel/destekdetay/…"> link.
  $(".col-lg-6.col-md-6.col-sm-6.col-xs-12").each((_i, el) => {
    const card = $(el);
    const descEl = card.find(".desc").first();
    const title = descEl.text().trim();

    if (!title || title.length < 4) return;

    // Skip navigation / boilerplate
    const lower = title.toLocaleLowerCase("tr");
    if (
      lower.includes("ana sayfa") ||
      lower.includes("hakkında") ||
      lower.includes("iletişim") ||
      lower.includes("gizlilik") ||
      lower.includes("devamı için")
    ) return;

    if (seen.has(title)) return;
    seen.add(title);

    // Find the detail link
    const linkEl = card.find("a[href]").first();
    let href = linkEl.attr("href") ?? "";
    if (href && !href.startsWith("http")) {
      href = `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
    }
    const sourceUrl = href || url;

    const ikn = slugify(title);

    tenders.push({
      ikn,
      title,
      agencyName: "KOSGEB",
      type: "KOSGEB Desteği",
      method: "Hibe / Destek Programı",
      estimatedValue: null,
      deadline: null,
      cpvCodes: [],
      il: "",
      status: "active",
      category: "hibe",
      description: [title, "KOSGEB Destek Programı"].filter(Boolean).join("\n"),
      sourceSystem: "kosgeb",
      sourceUrl,
      procurementMethod: null,
      documents: null,
      rawData: { pageNum, url: sourceUrl } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return tenders;
}

export async function runKosgbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("KOSGEB scraper starting");
    const allTenders: InsertTender[] = [];
    const seenIkn = new Set<string>();

    // Scrape first 10 pages (≈180 support programs) — avoids hammering the server
    for (let page = 1; page <= 10; page++) {
      const pageTenders = await retry(() => scrapeKosgbPage(page), 2, 2000);
      logger.info({ page, count: pageTenders.length }, "KOSGEB page scraped");

      if (pageTenders.length === 0) {
        logger.info({ page }, "KOSGEB: empty page, stopping pagination");
        break;
      }

      for (const t of pageTenders) {
        if (!seenIkn.has(t.ikn)) {
          seenIkn.add(t.ikn);
          allTenders.push(t);
        }
      }

      // Polite delay between pages
      await new Promise((r) => setTimeout(r, 500));
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
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert KOSGEB tender");
      }
    }

    logger.info(result, "KOSGEB scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "KOSGEB scraper failed");
  }

  await finalizeScraperRun({ source: "kosgeb", startedAt, result });
  return result;
}
