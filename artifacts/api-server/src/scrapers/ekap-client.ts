import axios, { AxiosInstance } from "axios";
import https from "https";
import crypto from "crypto";

const EKAP_BASE = "https://ekapv2.kik.gov.tr";
const AES_KEY = Buffer.from("Qm2LtXR0aByP69vZNKef4wMJ");

export interface EkapTender {
  id: string;
  ihaleAdi: string;
  ikn: string;
  ihaleTip: string;
  ihaleTipAciklama: string;
  ihaleUsul: string | null;
  ihaleUsulAciklama: string;
  ihaleDurum: string;
  ihaleDurumAciklama: string;
  idareAdi: string;
  ihaleIlAdi: string;
  ihaleTarihSaat: string;
  dokumanSayisi: number;
  dokumanListe: EkapDocument[];
}

export interface EkapDocument {
  adi: string;
  url: string;
  tur: string;
}

export interface EkapSearchResponse {
  list: EkapTender[];
  totalCount: number;
}

function aesCbcEncrypt(plaintext: string, key: Buffer, iv: Buffer): string {
  const cipher = crypto.createCipheriv("aes-192-cbc", key, iv);
  return Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]).toString("base64");
}

function generateSecurityHeaders(): Record<string, string> {
  const guid = crypto.randomUUID();
  const iv = crypto.randomBytes(16);
  const tsMs = String(Date.now());
  return {
    "X-Custom-Request-Guid": guid,
    "X-Custom-Request-Siv": iv.toString("base64"),
    "X-Custom-Request-Ts": aesCbcEncrypt(tsMs, AES_KEY, iv),
    "X-Custom-Request-R8id": aesCbcEncrypt(guid, AES_KEY, iv),
  };
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function createEkapClient(): AxiosInstance {
  return axios.create({
    baseURL: EKAP_BASE,
    timeout: 30000,
    httpsAgent,
    headers: {
      "Accept": "application/json",
      "Accept-Language": "tr",
      "Content-Type": "application/json",
      "Origin": EKAP_BASE,
      "Referer": `${EKAP_BASE}/ekap/search`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "api-version": "v1",
    },
  });
}

const client = createEkapClient();

function secHeaders() {
  return generateSecurityHeaders();
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function searchEkapTenders(
  startDate: string,
  endDate: string,
  skip = 0,
  take = 50,
): Promise<EkapSearchResponse> {
  const body = {
    ilanTarihSaatBaslangic: startDate,
    ilanTarihSaatBitis: endDate,
    paginationSkip: skip,
    paginationTake: take,
    ihaleTipler: [],
    ihaleUsuller: [],
    ihaleDurumlar: [],
    iller: [],
  };

  const response = await client.post(
    "/b_ihalearama/api/Ihale/GetListByParameters",
    body,
    { headers: secHeaders() },
  );

  const data = response.data;
  return {
    list: data.list ?? [],
    totalCount: data.totalCount ?? 0,
  };
}

export async function getAllEkapTendersForDate(
  startDate: string,
  endDate: string,
): Promise<EkapTender[]> {
  const firstPage = await searchEkapTenders(startDate, endDate, 0, 50);
  const allTenders: EkapTender[] = [...firstPage.list];
  const total = firstPage.totalCount;

  let skip = 50;
  while (allTenders.length < total) {
    await delay(300);
    const page = await searchEkapTenders(startDate, endDate, skip, 50);
    if (page.list.length === 0) break;
    allTenders.push(...page.list);
    skip += 50;
  }

  return allTenders;
}

export function formatEkapDate(daysBack = 1): { start: string; end: string } {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { start: formatDate(past), end: formatDate(now) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
