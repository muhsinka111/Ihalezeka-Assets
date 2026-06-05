import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * KOSGEB support programs to scrape. The main "tüm destekler" listing page
 * exposes a server-rendered list of support programs with titles and detail
 * links. We also scrape the hibe (grant) sub-category page for completeness.
 */
const KOSGEB_TARGETS = [
  {
    label: "Tüm Destekler",
    url: "https://www.kosgeb.gov.tr/site/tr/genel/destekler/0/tum-destekler",
  },
  {
    label: "Hibe Destekler",
    url: "https://www.kosgeb.gov.tr/site/tr/genel/detay/6440/hibe-destekler",
  },
];

function slugify(text: string): string {
  return `kosgeb-${text
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9ğüşıöç]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)}`;
}

async function scrapeKosgbTarget(
  label: string,
  url: string,
): Promise<InsertTender[]> {
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
    logger.warn({ label, url, err }, "KOSGEB target unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  // KOSGEB uses a variety of page layouts; try multiple selector patterns so we
  // catch both their legacy and current CMS structures.
  const rowSelectors = [
    ".destek-list li",
    ".destek-item",
    ".program-item",
    ".liste li",
    ".content-list li",
    ".list-group-item",
    "table.destek-table tbody tr",
    "table tbody tr",
    "article",
    ".card",
    ".panel",
  ];

  for (const sel of rowSelectors) {
    $(sel).each((_i, el) => {
      const row = $(el);

      const linkEl = row.find("a").first();
      const title =
        linkEl.text().trim() ||
        row.find("h3, h4, h2, .title, strong").first().text().trim() ||
        row.text().trim().split("\n")[0].trim();

      if (!title || title.length < 6) return;
      if (seen.has(title)) return;

      // Skip navigation/menu links that are not support programs.
      const lowerTitle = title.toLocaleLowerCase("tr");
      if (
        lowerTitle.includes("ana sayfa") ||
        lowerTitle.includes("hakkında") ||
        lowerTitle.includes("iletişim") ||
        lowerTitle.includes("gizlilik") ||
        lowerTitle.includes("site haritası")
      )
        return;

      seen.add(title);

      const href = linkEl.attr("href") ?? "";
      let sourceUrl = href;
      if (href && !href.startsWith("http")) {
        sourceUrl = `https://www.kosgeb.gov.tr${href.startsWith("/") ? "" : "/"}${href}`;
      }
      if (!sourceUrl) sourceUrl = url;

      const descEl = row.find("p, .description, .ozet").first();
      const description = descEl.text().trim() || null;

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
        description,
        sourceSystem: "kosgeb",
        sourceUrl,
        procurementMethod: null,
        documents: null,
        rawData: { label, url: sourceUrl } as Record<string, unknown>,
        lastFetchedAt: new Date(),
      });
    });

    if (tenders.length > 0) break;
  }

  return tenders;
}

export async function runKosgbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("KOSGEB scraper starting");
    const allTenders: InsertTender[] = [];
    const seenIkn = new Set<string>();

    for (const target of KOSGEB_TARGETS) {
      try {
        const tenders = await retry(
          () => scrapeKosgbTarget(target.label, target.url),
          2,
          3000,
        );
        logger.info(
          { label: target.label, count: tenders.length },
          "KOSGEB target scraped",
        );
        for (const t of tenders) {
          if (!seenIkn.has(t.ikn)) {
            seenIkn.add(t.ikn);
            allTenders.push(t);
          }
        }
      } catch (err) {
        logger.warn({ label: target.label, err }, "KOSGEB target scrape failed");
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
