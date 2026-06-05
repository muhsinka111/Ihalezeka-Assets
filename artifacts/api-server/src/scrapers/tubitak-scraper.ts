import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * TÜBİTAK support programs to scrape. The destekler/liste page is
 * server-rendered and exposes the full programme catalogue. We also scrape
 * the open-calls (açık çağrılar) feed where available.
 */
const TUBITAK_TARGETS = [
  {
    label: "Destekler Listesi",
    url: "https://www.tubitak.gov.tr/tr/destekler/liste",
    baseUrl: "https://www.tubitak.gov.tr",
  },
  {
    label: "Açık Çağrılar",
    url: "https://www.tubitak.gov.tr/tr/duyurular/acik-cagrilar",
    baseUrl: "https://www.tubitak.gov.tr",
  },
];

function slugify(text: string): string {
  return `tubitak-${text
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9ğüşıöç]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)}`;
}

/** Parse a Turkish date string "DD.MM.YYYY" or similar near a deadline keyword. */
function parseTubitatDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T23:59:00+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

async function scrapeTubitakTarget(
  label: string,
  url: string,
  baseUrl: string,
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
    logger.warn({ label, url, err }, "TÜBİTAK target unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  // TÜBİTAK uses a Drupal-based CMS with varying templates. Try multiple
  // selector patterns to handle both the "destekler" catalogue and "açık çağrı"
  // announcement pages.
  const rowSelectors = [
    ".view-content .views-row",
    ".field-items .field-item",
    ".destek-list li",
    ".acik-cagri-item",
    "article.node",
    ".node-destek",
    ".node-acik-cagri",
    ".views-row",
    "ul.menu li",
    "table tbody tr",
    ".item-list li",
    "li.leaf",
  ];

  for (const sel of rowSelectors) {
    $(sel).each((_i, el) => {
      const row = $(el);

      const linkEl = row.find("a").first();
      const title =
        linkEl.text().trim() ||
        row.find("h2, h3, h4, .field-title, .node-title").first().text().trim() ||
        row.text().trim().split("\n")[0].trim();

      if (!title || title.length < 6) return;
      if (seen.has(title)) return;

      // Skip navigation/boilerplate links.
      const lowerTitle = title.toLocaleLowerCase("tr");
      if (
        lowerTitle.includes("ana sayfa") ||
        lowerTitle.includes("hakkında") ||
        lowerTitle.includes("iletişim") ||
        lowerTitle.includes("gizlilik") ||
        lowerTitle.includes("site haritası") ||
        lowerTitle.includes("english") ||
        lowerTitle.includes("cookie")
      )
        return;

      seen.add(title);

      const href = linkEl.attr("href") ?? "";
      let sourceUrl = href;
      if (href && !href.startsWith("http")) {
        sourceUrl = `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
      }
      if (!sourceUrl) sourceUrl = url;

      // Try to extract a deadline from any date-like text in the row.
      const rowText = row.text();
      let deadline: Date | null = null;
      const dateKeywordMatch = rowText.match(
        /(?:son\s+başvuru|son\s+tarih|bitiş\s+tarihi|deadline)[:\s]*([^\n]+)/i,
      );
      if (dateKeywordMatch) {
        deadline = parseTubitatDate(dateKeywordMatch[1]);
      }
      if (!deadline) {
        deadline = parseTubitatDate(rowText);
      }

      const descEl = row.find("p, .field-body, .description, .ozet, .summary").first();
      const description = descEl.text().trim().slice(0, 500) || null;

      const ikn = slugify(title);

      tenders.push({
        ikn,
        title,
        agencyName: "TÜBİTAK",
        type: "TÜBİTAK Desteği",
        method: "Hibe / Ar-Ge Destek Programı",
        estimatedValue: null,
        deadline,
        cpvCodes: [],
        il: "",
        status: "active",
        category: "hibe",
        description,
        sourceSystem: "tubitak",
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

export async function runTubitakScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("TÜBİTAK scraper starting");
    const allTenders: InsertTender[] = [];
    const seenIkn = new Set<string>();

    for (const target of TUBITAK_TARGETS) {
      try {
        const tenders = await retry(
          () => scrapeTubitakTarget(target.label, target.url, target.baseUrl),
          2,
          3000,
        );
        logger.info(
          { label: target.label, count: tenders.length },
          "TÜBİTAK target scraped",
        );
        for (const t of tenders) {
          if (!seenIkn.has(t.ikn)) {
            seenIkn.add(t.ikn);
            allTenders.push(t);
          }
        }
      } catch (err) {
        logger.warn({ label: target.label, err }, "TÜBİTAK target scrape failed");
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
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert TÜBİTAK tender");
      }
    }

    logger.info(result, "TÜBİTAK scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "TÜBİTAK scraper failed");
  }

  await finalizeScraperRun({ source: "tubitak", startedAt, result });

  return result;
}
