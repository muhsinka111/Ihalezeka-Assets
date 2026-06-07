import axios, { AxiosInstance } from "axios";
import https from "https";

const ILAN_BASE = "https://www.ilan.gov.tr";

export interface IlanAd {
  id: string;
  adNo: string;
  advertiserName: string;
  title: string;
  addressCityName: string;
  addressCountyName: string;
  publishStartDate: string;
  urlStr: string;
  adSourceName: string;
  isArchived?: boolean;
}

export interface IlanSearchResponse {
  ads: IlanAd[];
  numFound: number;
}

export interface IlanAdDetail extends IlanAd {
  text?: string;
  publishEndDate?: string;
  categoryName?: string;
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function createIlanClient(): AxiosInstance {
  return axios.create({
    baseURL: ILAN_BASE,
    timeout: 30000,
    httpsAgent,
    headers: {
      "accept": "text/plain",
      "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "no-cache",
      "content-type": "application/json-patch+json",
      "origin": ILAN_BASE,
      "referer": `${ILAN_BASE}/ilan/tum-ilanlar`,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "x-request-origin": "IGT-UI",
      "x-requested-with": "XMLHttpRequest",
    },
  });
}

const client = createIlanClient();

function formatTRDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

/**
 * Keyword-based live search against İlan.gov.tr API.
 * Uses the `q` key for general full-text search across ad titles and content.
 * No date restriction — surfaces all matching ads including older ones.
 */
export async function searchIlanByKeyword(
  text: string,
  skipCount = 0,
  maxResultCount = 20,
): Promise<IlanSearchResponse> {
  const body = {
    keys: {
      q: [text],
      ats: [3, 4, 5],
    },
    skipCount,
    maxResultCount,
  };

  const response = await client.post("/api/api/services/app/Ad/AdsByFilter", body);
  const result = response.data?.result;
  return {
    ads: result?.ads ?? [],
    numFound: result?.numFound ?? 0,
  };
}

export async function searchIlanAds(
  skipCount = 0,
  maxResultCount = 50,
  dateFromDaysAgo = 2,
): Promise<IlanSearchResponse> {
  const cutoff = new Date(Date.now() - dateFromDaysAgo * 24 * 60 * 60 * 1000);

  const body = {
    keys: {
      ats: [3, 4, 5],
      ppdmin: [formatTRDate(cutoff)],
    },
    skipCount,
    maxResultCount,
  };

  const response = await client.post(
    "/api/api/services/app/Ad/AdsByFilter",
    body,
  );

  const result = response.data?.result;
  return {
    ads: result?.ads ?? [],
    numFound: result?.numFound ?? 0,
  };
}

export async function getAllRecentIlanAds(hoursBack = 48): Promise<IlanAd[]> {
  const daysBack = Math.ceil(hoursBack / 24);
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const allAds: IlanAd[] = [];
  let skip = 0;
  const take = 50;

  while (true) {
    const page = await searchIlanAds(skip, take, daysBack);
    if (page.ads.length === 0) break;

    const recentAds = page.ads.filter((ad) => {
      const pubDate = new Date(ad.publishStartDate);
      return pubDate >= cutoff && !ad.isArchived;
    });

    allAds.push(...recentAds);

    if (recentAds.length < page.ads.length || allAds.length >= page.numFound) break;

    skip += take;
    await delay(300);
  }

  return allAds;
}

export async function getIlanAdDetail(
  adId: string,
): Promise<IlanAdDetail | null> {
  try {
    await delay(300);
    const response = await client.get(
      `/api/api/services/app/AdDetail/GetAdDetail?id=${adId}`,
    );
    const result = response.data?.result;
    return result ?? null;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
