import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

interface KalkinmaTarget {
  agency: string;
  shortCode: string;
  region: string;
  il: string;
  urls: string[];
}

const KALKINMA_TARGETS: KalkinmaTarget[] = [
  {
    agency: "BEBKA",
    shortCode: "bebka",
    region: "Bursa, Eskişehir, Bilecik",
    il: "Bursa",
    urls: [
      "https://www.bebka.org.tr/tr/destekler/",
      "https://www.bebka.org.tr/tr/haberler/",
    ],
  },
  {
    agency: "İSTKA",
    shortCode: "istka",
    region: "İstanbul",
    il: "İstanbul",
    urls: [
      "https://www.istka.org.tr/destekler/",
      "https://www.istka.org.tr/haberler/",
    ],
  },
  {
    agency: "İZKA",
    shortCode: "izka",
    region: "İzmir",
    il: "İzmir",
    urls: [
      "https://www.izka.org.tr/tum-destekler/",
      "https://www.izka.org.tr/haberler/",
    ],
  },
  {
    agency: "BAKA",
    shortCode: "baka",
    region: "Antalya, Burdur, Isparta",
    il: "Antalya",
    urls: [
      "https://www.baka.org.tr/tr/destekler/",
      "https://www.baka.org.tr/tr/haberler/",
    ],
  },
  {
    agency: "MARKA",
    shortCode: "marka",
    region: "Düzce, Sakarya, Bolu, Zonguldak, Karabük, Bartın",
    il: "Sakarya",
    urls: [
      "https://www.marka.org.tr/destekler/",
      "https://www.marka.org.tr/haberler/",
    ],
  },
];

function slugify(agency: string, title: string): string {
  return `kalkinma-${agency.toLowerCase()}-${title.trim().toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]+/gi, "-").slice(0, 60)}`;
}

async function scrapeKalkinmaPage(target: KalkinmaTarget, url: string): Promise<InsertTender[]> {
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
    logger.warn({ agency: target.agency, url, err }, "Kalkınma ajansı page unreachable");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  $("article, .destek-item, .support-item, .card, li.item, .haber-item, .program-item").each((_i, el) => {
    const el$ = $(el);
    const titleEl = el$.find("h2, h3, h4, a, .title, .baslik").first();
    const title = titleEl.text().trim();
    if (!title || title.length < 8 || seen.has(title)) return;
    seen.add(title);

    const href = titleEl.attr("href") ?? el$.find("a").first().attr("href") ?? "";
    let sourceUrl = href;
    if (href && !href.startsWith("http")) {
      try {
        const base = new URL(url);
        sourceUrl = `${base.protocol}//${base.host}${href.startsWith("/") ? "" : "/"}${href}`;
      } catch {
        sourceUrl = url;
      }
    }
    if (!sourceUrl) sourceUrl = url;

    const descEl = el$.find("p, .desc, .ozet, .summary").first();
    const description = descEl.text().trim().slice(0, 500) || null;

    const dateText = el$.find("time, .tarih, .deadline, .date, .son-basvuru").text().trim();
    let deadline: Date | null = null;
    if (dateText) {
      const parsed = new Date(dateText.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));
      if (!isNaN(parsed.getTime())) deadline = parsed;
    }

    tenders.push({
      ikn: slugify(target.shortCode, title),
      title,
      agencyName: target.agency,
      type: "Kalkınma Ajansı Hibesi",
      method: "Hibe",
      estimatedValue: null,
      deadline,
      cpvCodes: [],
      il: target.il,
      status: "active",
      category: "hibe",
      description,
      sourceSystem: "kalkinma_ajansi",
      sourceUrl,
      procurementMethod: "Hibe",
      documents: null,
      rawData: { agency: target.agency, region: target.region, url } as Record<string, unknown>,
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
    const allTenders: InsertTender[] = [];

    for (const target of KALKINMA_TARGETS) {
      for (const url of target.urls) {
        try {
          const tenders = await retry(() => scrapeKalkinmaPage(target, url), 2, 2000);
          logger.info({ agency: target.agency, url, count: tenders.length }, "Kalkınma page scraped");
          allTenders.push(...tenders);
        } catch (err) {
          logger.warn({ agency: target.agency, url, err }, "Kalkınma page scrape failed");
        }
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
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert Kalkınma grant");
      }
    }

    logger.info(result, "Kalkınma Ajansları scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "Kalkınma Ajansları scraper failed");
  }

  await logScraperRun({
    source: "kalkinma_ajansi",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
