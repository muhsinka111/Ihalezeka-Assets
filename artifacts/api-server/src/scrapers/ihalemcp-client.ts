/**
 * Client for the hosted ihale-mcp MCP server.
 * Endpoint: https://ihalemcp.fastmcp.app/mcp
 * Protocol: JSON-RPC 2.0 over Streamable HTTP (SSE or plain JSON response)
 * Source: https://github.com/saidsurucu/ihale-mcp
 *
 * Auth: optional — if IHALEMCP_API_KEY is set, it is sent as
 * "Authorization: Bearer <key>" on every request.
 */

import axios from "axios";
import { logger } from "../lib/logger.js";
import type { EkapTender, EkapSearchResponse } from "./ekap-client.js";

const MCP_URL = "https://ihalemcp.fastmcp.app/mcp";
let _reqId = 0;

interface McpContent {
  type: string;
  text: string;
}
interface McpResult {
  content?: McpContent[];
  isError?: boolean;
}
interface McpMsg {
  id?: number | string;
  result?: McpResult;
  error?: unknown;
}

async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const id = ++_reqId;

  const apiKey = process.env.IHALEMCP_API_KEY;
  const authHeader = apiKey ? { "Authorization": `Bearer ${apiKey}` } : {};

  const res = await axios.post<string>(
    MCP_URL,
    {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...authHeader,
      },
      timeout: 30_000,
      responseType: "text",
      validateStatus: () => true,
    },
  );

  return extractResult(res.data, id);
}

function extractResult(raw: string, id: number): string {
  if (!raw?.trim()) throw new Error("ihale-mcp: empty response");

  // Plain JSON response
  if (raw.trimStart().startsWith("{")) {
    try {
      const msg = JSON.parse(raw) as McpMsg;
      if (msg.error)
        throw new Error(`ihale-mcp error: ${JSON.stringify(msg.error)}`);
      if (msg.result) return getTextContent(msg.result);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("ihale-mcp")) throw e;
    }
  }

  // SSE stream: blocks separated by \n\n, each block has "data: <json>" lines
  for (const block of raw.split("\n\n")) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (!dataLine) continue;
    try {
      const msg = JSON.parse(dataLine.slice(6)) as McpMsg;
      if (msg.error)
        throw new Error(`ihale-mcp error: ${JSON.stringify(msg.error)}`);
      if (msg.id === id && msg.result) return getTextContent(msg.result);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("ihale-mcp")) throw e;
    }
  }

  throw new Error("ihale-mcp: no matching result in response");
}

function getTextContent(result: McpResult): string {
  if (result.isError)
    throw new Error("ihale-mcp: tool returned isError=true");
  return (result.content ?? []).find((c) => c.type === "text")?.text ?? "";
}

function tryParseJson(text: string): Record<string, unknown> {
  if (!text?.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {}
  // Handle markdown code fences
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try {
      return JSON.parse(m[1]) as Record<string, unknown>;
    } catch {}
  }
  return {};
}

function mapSearchResponse(text: string): EkapSearchResponse {
  const data = tryParseJson(text);
  const raw = data.list ?? data.ihaleler ?? data.results ?? data.data;
  const list = Array.isArray(raw) ? (raw as EkapTender[]) : [];
  const total = data.totalCount ?? data.toplam ?? data.total ?? list.length;
  return {
    list,
    totalCount: typeof total === "number" ? total : list.length,
  };
}

/**
 * Keyword-based tender search via ihale-mcp.
 * Searches title + announcement text. No date restriction.
 */
export async function searchTendersViaMcp(params: {
  searchText?: string;
  announcementDateStart?: string;
  announcementDateEnd?: string;
  provinces?: string[];
  tenderTypes?: string[];
  skip?: number;
  take?: number;
}): Promise<EkapSearchResponse> {
  const args: Record<string, unknown> = {
    skip: params.skip ?? 0,
    take: params.take ?? 20,
    search_in_title: true,
    search_in_announcement: true,
  };
  if (params.searchText) args.search_text = params.searchText;
  if (params.announcementDateStart)
    args.announcement_date_start = params.announcementDateStart;
  if (params.announcementDateEnd)
    args.announcement_date_end = params.announcementDateEnd;
  if (params.provinces?.length) args.provinces = params.provinces;
  if (params.tenderTypes?.length) args.tender_types = params.tenderTypes;

  const text = await callMcpTool("search_tenders", args);
  return mapSearchResponse(text);
}

/**
 * Fetch tenders published in the last N days — ideal for daily scraping.
 */
export async function getRecentTendersViaMcp(
  days = 1,
  limit = 100,
): Promise<EkapSearchResponse> {
  const text = await callMcpTool("get_recent_tenders", { days, limit });
  return mapSearchResponse(text);
}

/**
 * Fetch all announcement text for a tender (IKN-based). Returns Markdown text.
 * Used to populate `description` / grounding for AI analysis.
 * Returns "" on failure — callers should degrade gracefully.
 */
export async function getTenderAnnouncementsViaMcp(ikn: string): Promise<string> {
  try {
    return await callMcpTool("get_tender_announcements", { tender_id: ikn });
  } catch (err) {
    logger.debug({ ikn, err }, "ihale-mcp get_tender_announcements failed");
    return "";
  }
}

/**
 * Fetch structured tender details (attributes, OKAS codes, authority info).
 * Returns a parsed object; empty on failure.
 */
export async function getTenderDetailsViaMcp(
  ikn: string,
): Promise<Record<string, unknown>> {
  try {
    const text = await callMcpTool("get_tender_details", { tender_id: ikn });
    return tryParseJson(text);
  } catch (err) {
    logger.debug({ ikn, err }, "ihale-mcp get_tender_details failed");
    return {};
  }
}
