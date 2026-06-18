import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, tendersTable, companyProfilesTable, pipelineItemsTable } from "@workspace/db";
import { eq, desc, and, or, gte, isNull, ilike, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { searchEkapByKeyword } from "../scrapers/ekap-client.js";
import { mapEkapToTender } from "../scrapers/utils.js";
import { getTenderDetailsViaMcp, getTenderAnnouncementsViaMcp } from "../scrapers/ihalemcp-client.js";
import { requirePro, getBusinessId } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: the AI assistant is a Pro feature.
router.use("/ai", requirePro);

const AI_CHAT_MODEL = "claude-opus-4-8";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface TenderContext {
  title?: string;
  agency?: string;
  estimatedValue?: number | null;
  deadline?: string | null;
  aiSummary?: string | null;
  type?: string | null;
}

interface TopMatch {
  title: string;
  agency: string;
  fitScore: number;
  deadline?: string | null;
}

interface ChatContext {
  mode: "general" | "proposal";
  tender?: TenderContext;
  topMatches?: TopMatch[];
  companyName?: string;
  aiBrief?: string | null;
  currentDraft?: string;
}

const EDIT_INTENT_KEYWORDS = [
  "güncelle", "yaz", "ekle", "düzenle", "değiştir", "revize", "geliştir",
  "tamamla", "çıkar", "kısalt", "genişlet", "oluştur", "yeniden yaz",
  "bölümünü", "paragrafı", "taslak", "metnini", "içeriğini", "fiyat",
  "giriş", "teknik", "sonuç", "firma", "referans", "update", "rewrite",
];

function detectsEditIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return EDIT_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildSystemPrompt(context: ChatContext): string {
  const base = `Sen İhaleZeka'nın yapay zeka asistanısın — Türkiye kamu ihale mevzuatında uzman, deneyimli bir ihale danışmanısın.

## Uzmanlık alanların:
- **4734 Sayılı Kamu İhale Kanunu** ve uygulamaları
- **EKAP** (Elektronik Kamu Alımları Platformu) — ihale ilanı, doküman ve sonuç takibi
- **KİK** (Kamu İhale Kurumu) — mevzuat, kararlar, itiraz süreçleri
- **İhale türleri**: Açık ihale, belli istekliler arasında ihale, pazarlık usulü (Md. 19, 20, 21)
- **Alım kategorileri**: Mal alımı, hizmet alımı, yapım işleri, danışmanlık hizmetleri
- **CPV/OKAS kodları** — Avrupa Birleşik Tedarik Sözlüğü ve ihale sınıflandırması
- **Yaklaşık maliyet**, **geçici teminat** (%3), **kesin teminat** (%6) hesaplamaları
- **Yeterlik kriterleri**: Mali ve teknik kapasite, iş deneyim belgeleri
- **İstisna kapsamı**: 3/g, 3/f maddeleri ve doğrudan temin

## Davranış kuralları:
1. **Her zaman Türkçe yanıt ver.** Kısa, net, doğrudan ol.
2. **Araçları önce kullan:** Kullanıcı ihale sormadan önce search_tenders veya get_tender_detail aracını çağır — asla tahmin etme.
3. **Gerçek verilerle yanıtla:** Araç sonuçlarını özetle, arayüz ihale kartlarını otomatik gösterir.
4. **Bilmediğini kabul et:** Eğer araçtan sonuç gelmezse veya veri yoksa açıkça belirt — asla uydurmayasın.
5. **Markdown kullan:** Listeler, başlıklar, kalın metin ile okunabilirliği artır.
6. Gereksiz giriş cümleleri ekleme ("Tabii ki!", "Harika soru!" gibi). Doğrudan cevaba geç.`;

  if (context.mode === "general") {
    const matchesSummary =
      context.topMatches && context.topMatches.length > 0
        ? `\n\n## Kullanıcının Önerilen Fırsatları (uyum skoruna göre):\n` +
          context.topMatches
            .slice(0, 5)
            .map(
              (m) =>
                `- ${m.title} (${m.agency}) — Uyum: %${m.fitScore}${
                  m.deadline
                    ? `, Son Tarih: ${new Date(m.deadline).toLocaleDateString("tr-TR")}`
                    : ""
                }`
            )
            .join("\n")
        : "";

    const companySummary = context.companyName
      ? `\n\n## Kullanıcının Firması: ${context.companyName}`
      : "";

    const briefSummary = context.aiBrief
      ? `\n\n## Firma Profili (kullanıcı tarafından girilmiş):\n${context.aiBrief}`
      : "";

    return `${base}${companySummary}${briefSummary}${matchesSummary}

Kullanıcı kendi ihaleleri, fırsatları veya platformdaki veriler hakkında soru soruyorsa araçları kullanarak gerçek verileri çek. Eğer araçtan sonuç gelmezse bunu açıkça belirt.`;
  }

  if (context.mode === "proposal") {
    const t = context.tender;
    const tenderInfo = t
      ? `\n\n## Aktif İhale:\n- **Başlık:** ${t.title ?? "Belirtilmemiş"}\n- **Kurum:** ${t.agency ?? "Belirtilmemiş"}\n- **Tür:** ${t.type ?? "Belirtilmemiş"}\n- **Tahmini Bedel:** ${t.estimatedValue ? t.estimatedValue.toLocaleString("tr-TR") + " TL" : "Belirtilmemiş"}\n- **Son Tarih:** ${t.deadline ? new Date(t.deadline).toLocaleDateString("tr-TR") : "Belirtilmemiş"}${t.aiSummary ? `\n\n## Belge / Şartname Özeti:\n${t.aiSummary}` : ""}`
      : "";

    const briefSummary = context.aiBrief
      ? `\n\n## Firma Profili:\n${context.aiBrief}`
      : "";

    return `${base}${briefSummary}

Kullanıcı şu anda bir ihale için teklif mektubu hazırlıyor. Teknik yaklaşım, fiyatlandırma stratejisi, referans projeler ve şartname gereksinimleri konularında yardım et. Önerilerini doğrudan teklif metnine dahil edilebilecek şekilde yaz.${tenderInfo}`;
  }

  return base;
}

function buildPatchSystemPrompt(context: ChatContext): string {
  const t = context.tender;
  const tenderInfo = t
    ? `\nAktif İhale: ${t.title ?? ""} — ${t.agency ?? ""}${t.estimatedValue ? ` — ${t.estimatedValue.toLocaleString("tr-TR")} TL` : ""}${t.deadline ? ` — Son Tarih: ${new Date(t.deadline).toLocaleDateString("tr-TR")}` : ""}`
    : "";

  return `Sen profesyonel bir ihale teklif yazarısın. Kullanıcının isteğine göre mevcut teklif taslağını güncelleyeceksin.${tenderInfo}

Kurallar:
- Mevcut taslağı tamamen koru, yalnızca istenen bölümü değiştir veya ekle.
- Yalnızca güncellenmiş teklif metnini döndür — başka hiçbir şey ekleme, açıklama yapma.
- Formatı (markdown başlıklar, listeler vb.) koru.
- Türkçe yaz.`;
}

// ── Agent tools ────────────────────────────────────────────────────

const TOOLS_ANTHROPIC = [
  {
    name: "search_tenders",
    description:
      "Türkiye kamu ihale veritabanında aktif (süresi geçmemiş) ihaleleri arar. Kullanıcı bir konu, anahtar kelime, şehir veya ihale türü için ihale aramak istediğinde kullan.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: {
          type: "string",
          description: "İhale başlığı veya kurum adında aranacak anahtar kelime (ör. 'yazılım', 'inşaat', 'tıbbi cihaz').",
        },
        il: { type: "string", description: "İhalenin yapılacağı il (ör. 'Ankara', 'İstanbul')." },
        type: { type: "string", description: "İhale türü: 'Mal', 'Hizmet' veya 'Yapım'." },
        limit: { type: "number", description: "Döndürülecek en fazla ihale sayısı (varsayılan 8, en fazla 12)." },
      },
    },
  },
  {
    name: "get_tender_detail",
    description:
      "Belirli bir ihalenin tam detaylarını döndürür: açıklama, belgeler, AI özeti, CPV kodları, ihale yöntemi. Kullanıcı belirli bir ihale hakkında detaylı soru sorduğunda ya da ihale ID veya IKN numarası bilindiğinde kullan.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "İhalenin sayısal veritabanı ID'si (ör. '142') veya IKN kodu (ör. '2024/123456'). search_tenders sonucundaki id alanından alınabilir.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_top_matches",
    description:
      "Kullanıcının firma profiline göre en yüksek uyum skoruna sahip ihale fırsatlarını döndürür. Kullanıcı 'bana uygun ihaleler', 'en iyi fırsatlarım' gibi şeyler sorduğunda kullan.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Döndürülecek en fazla fırsat sayısı (varsayılan 6)." },
      },
    },
  },
  {
    name: "get_upcoming_deadlines",
    description:
      "Son başvuru tarihi en yakın olan aktif ihaleleri döndürür. Kullanıcı yaklaşan son tarihleri sorduğunda kullan.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Döndürülecek en fazla ihale sayısı (varsayılan 6)." },
      },
    },
  },
  {
    name: "add_to_pipeline",
    description:
      "Belirtilen ihaleyi kullanıcının takip listesine (pipeline) ekler. Kullanıcı bir ihaleyi takip etmek/pipeline'a eklemek istediğinde kullan. tenderId, search_tenders veya get_top_matches sonuçlarından alınmalıdır.",
    input_schema: {
      type: "object" as const,
      properties: {
        tenderId: { type: "number", description: "Pipeline'a eklenecek ihalenin sayısal ID'si." },
      },
      required: ["tenderId"],
    },
  },
];

function serializeTender(t: typeof tendersTable.$inferSelect) {
  return {
    id: t.id,
    ikn: t.ikn,
    title: t.title,
    agency: t.agencyName,
    agencyLogoUrl: t.agencyLogoUrl,
    type: t.type,
    il: t.il,
    estimatedValue: t.estimatedValue,
    deadline: t.deadline?.toISOString() ?? null,
    sourceSystem: t.sourceSystem,
    sourceUrl: t.sourceUrl,
  };
}

async function runSearchTenders(args: { q?: string; il?: string; type?: string; limit?: number }) {
  const limit = Math.min(args.limit ?? 8, 12);
  const now = new Date();
  const conditions = [
    or(gte(tendersTable.deadline, now), isNull(tendersTable.deadline))!,
    eq(tendersTable.status, "active"),
  ];
  if (args.q) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${args.q}%`),
        ilike(tendersTable.agencyName, `%${args.q}%`)
      )!
    );
  }
  if (args.il) conditions.push(ilike(tendersTable.il, `%${args.il}%`));
  if (args.type) conditions.push(ilike(tendersTable.type, `%${args.type}%`));

  const dbRows = await db
    .select()
    .from(tendersTable)
    .where(and(...conditions))
    .orderBy(sql`${tendersTable.deadline} ASC NULLS LAST`)
    .limit(limit);

  const results = dbRows.map(serializeTender);

  // If DB returned fewer than 4 results and a keyword was given, augment with
  // live EKAP search so the agent can surface tenders not yet scraped.
  if (args.q && results.length < 4) {
    try {
      const live = await searchEkapByKeyword(args.q, 0, limit - results.length);
      const seenIkns = new Set(results.map((r) => r.ikn));
      for (const t of live.list) {
        const mapped = mapEkapToTender(t);
        if (!seenIkns.has(mapped.ikn)) {
          seenIkns.add(mapped.ikn);
          results.push({
            id: 0, // ephemeral — no DB id for live results
            ikn: mapped.ikn ?? "",
            title: mapped.title,
            agency: mapped.agencyName,
            agencyLogoUrl: null,
            type: mapped.type,
            il: mapped.il ?? "",
            estimatedValue: mapped.estimatedValue ?? null,
            deadline: mapped.deadline?.toISOString() ?? null,
            sourceSystem: "ekap",
            sourceUrl: mapped.ikn
              ? `https://ekapv2.kik.gov.tr/ekap/detay/${mapped.ikn}`
              : null,
          });
        }
        if (results.length >= limit) break;
      }
    } catch (err) {
      logger.warn({ err }, "Live EKAP fallback in search_tenders failed — using DB results only");
    }
  }

  return results;
}

async function runGetTenderDetail(args: { id: string }) {
  let tender: typeof tendersTable.$inferSelect | undefined;

  // Try numeric DB id first
  const numId = parseInt(args.id, 10);
  if (!isNaN(numId)) {
    const rows = await db.select().from(tendersTable).where(eq(tendersTable.id, numId)).limit(1);
    tender = rows[0];
  }

  // Fall back to IKN lookup
  if (!tender) {
    const rows = await db.select().from(tendersTable).where(eq(tendersTable.ikn, args.id)).limit(1);
    tender = rows[0];
  }

  // MCP live fallback: args.id may be an IKN (e.g. "2026/123456") not yet in DB
  if (!tender) {
    try {
      const [mcpDetails, mcpAnnouncement] = await Promise.all([
        getTenderDetailsViaMcp(args.id),
        getTenderAnnouncementsViaMcp(args.id),
      ]);
      const hasData = Object.keys(mcpDetails).length > 0 || mcpAnnouncement.length > 50;
      if (hasData) {
        const d = mcpDetails as Record<string, unknown>;
        return {
          id: null,
          ikn: args.id,
          title: (d.ihaleAdi ?? d.title ?? d.name ?? args.id) as string,
          agency: (d.idareAdi ?? d.agency ?? "") as string,
          type: (d.ihaleTipAciklama ?? d.type ?? "") as string,
          method: (d.ihaleUsulAciklama ?? d.method ?? "") as string,
          il: (d.ihaleIlAdi ?? d.il ?? "") as string,
          category: (d.category ?? "ihale") as string,
          estimatedValue: null,
          deadline: null,
          status: (d.ihaleDurumAciklama ?? d.status ?? "active") as string,
          sourceSystem: "ekap",
          sourceUrl: `https://ekapv2.kik.gov.tr/ekap/detay/${args.id}`,
          description: mcpAnnouncement.slice(0, 2500) || null,
          aiSummary: null,
          cpvCodes: [],
          documentCount: 0,
          documents: [],
          _source: "ihale-mcp",
        };
      }
    } catch (err) {
      logger.debug({ id: args.id, err }, "ihale-mcp live lookup failed");
    }
    return { error: `"${args.id}" ID/IKN'si için ihale bulunamadı.` };
  }

  const docs = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];

  return {
    id: tender.id,
    ikn: tender.ikn,
    title: tender.title,
    agency: tender.agencyName,
    type: tender.type,
    method: tender.method,
    il: tender.il,
    category: tender.category,
    estimatedValue: tender.estimatedValue,
    deadline: tender.deadline?.toISOString() ?? null,
    status: tender.status,
    sourceSystem: tender.sourceSystem,
    sourceUrl: tender.sourceUrl,
    // Truncate long description/summary to keep context window sane
    description: tender.description ? tender.description.slice(0, 2500) : null,
    aiSummary: tender.aiSummary ? ((tender.aiSummary as unknown as { summary?: string }).summary?.slice(0, 2000) ?? null) : null,
    cpvCodes: tender.cpvCodes,
    documentCount: docs.length,
    documents: docs.slice(0, 5).map((d) => ({ name: d.name, type: d.type })),
  };
}

async function runGetTopMatches(args: { limit?: number }, businessId: string) {
  const limit = Math.min(args.limit ?? 6, 10);
  const rows = await db
    .select()
    .from(matchesTable)
    .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
    .where(eq(matchesTable.businessId, businessId))
    .orderBy(desc(matchesTable.fitScore))
    .limit(limit);

  return rows.map((r) => ({
    ...serializeTender(r.tenders),
    fitScore: r.matches.fitScore,
    reasoning: r.matches.reasoning,
  }));
}

async function runGetUpcomingDeadlines(args: { limit?: number }) {
  const limit = Math.min(args.limit ?? 6, 10);
  const now = new Date();
  const rows = await db
    .select()
    .from(tendersTable)
    .where(and(gte(tendersTable.deadline, now), eq(tendersTable.status, "active")))
    .orderBy(sql`${tendersTable.deadline} ASC`)
    .limit(limit);
  return rows.map(serializeTender);
}

async function runAddToPipeline(args: { tenderId: number }, businessId: string) {
  const [tender] = await db
    .select()
    .from(tendersTable)
    .where(eq(tendersTable.id, args.tenderId))
    .limit(1);
  if (!tender) {
    return { ok: false, message: `${args.tenderId} numaralı ihale bulunamadı.` };
  }
  const existing = await db
    .select()
    .from(pipelineItemsTable)
    .where(
      and(
        eq(pipelineItemsTable.businessId, businessId),
        eq(pipelineItemsTable.tenderId, args.tenderId)
      )
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, alreadyExists: true, message: `"${tender.title}" zaten takip listenizde.`, tender: serializeTender(tender) };
  }
  await db.insert(pipelineItemsTable).values({
    businessId,
    tenderId: args.tenderId,
    stage: "discovery",
  });
  return { ok: true, message: `"${tender.title}" takip listenize (Fırsat Keşfi) eklendi.`, tender: serializeTender(tender) };
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  search_tenders: "İhaleler aranıyor…",
  get_tender_detail: "İhale detayları alınıyor…",
  get_top_matches: "En iyi eşleşmeler yükleniyor…",
  get_upcoming_deadlines: "Yaklaşan son tarihler alınıyor…",
  add_to_pipeline: "Pipeline'a ekleniyor…",
};

async function executeTool(name: string, args: any, sse: (obj: unknown) => void, businessId: string) {
  switch (name) {
    case "search_tenders": {
      const results = await runSearchTenders(args);
      if (results.length) sse({ tenders: results });
      return { count: results.length, tenders: results };
    }
    case "get_tender_detail": {
      const result = await runGetTenderDetail(args);
      if (!("error" in result)) {
        // Emit a tender card so the UI shows it inline, plus pass full detail to the model
        sse({
          tenders: [{
            id: result.id,
            title: result.title,
            agency: result.agency,
            agencyLogoUrl: null,
            type: result.type,
            il: result.il,
            estimatedValue: result.estimatedValue,
            deadline: result.deadline,
            sourceSystem: result.sourceSystem,
          }],
        });
      }
      return result;
    }
    case "get_top_matches": {
      const results = await runGetTopMatches(args, businessId);
      if (results.length) sse({ tenders: results });
      return { count: results.length, matches: results };
    }
    case "get_upcoming_deadlines": {
      const results = await runGetUpcomingDeadlines(args);
      if (results.length) sse({ tenders: results });
      return { count: results.length, tenders: results };
    }
    case "add_to_pipeline": {
      const result = await runAddToPipeline(args, businessId);
      sse({ action: { type: "pipeline_added", ok: result.ok, message: result.message } });
      return result;
    }
    default:
      return { error: `Bilinmeyen araç: ${name}` };
  }
}


router.post("/ai/chat", async (req, res) => {
  try {
    const { messages, context } = req.body as {
      messages: ChatMessage[];
      context?: ChatContext;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const chatContext: ChatContext = context ?? { mode: "general" };
    const businessId = getBusinessId(req);

    // Always fetch company profile so aiBrief is injected in every mode.
    if (!chatContext.aiBrief) {
      try {
        const profileFetch = db
          .select()
          .from(companyProfilesTable)
          .where(eq(companyProfilesTable.businessId, businessId))
          .limit(1);

        if (chatContext.mode === "general" && !chatContext.topMatches) {
          const [rows, profileRows] = await Promise.all([
            db
              .select()
              .from(matchesTable)
              .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
              .where(eq(matchesTable.businessId, businessId))
              .orderBy(desc(matchesTable.fitScore))
              .limit(6),
            profileFetch,
          ]);

          chatContext.topMatches = rows.map((r) => ({
            title: r.tenders.title,
            agency: r.tenders.agencyName,
            fitScore: r.matches.fitScore,
            deadline: r.tenders.deadline?.toISOString() ?? null,
          }));

          if (profileRows[0]) {
            chatContext.companyName = profileRows[0].companyName;
            if (profileRows[0].aiBrief) {
              chatContext.aiBrief = profileRows[0].aiBrief;
            }
          }
        } else {
          const profileRows = await profileFetch;
          if (profileRows[0]?.aiBrief) {
            chatContext.aiBrief = profileRows[0].aiBrief;
          }
        }
      } catch (err) {
        logger.warn({ err }, "Failed to fetch context for AI chat — continuing without it");
      }
    }

    const systemPrompt = buildSystemPrompt(chatContext);

    // Build Anthropic messages (system is separate — filter out any system role from history)
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: any }> =
      messages.slice(-12)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sse = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    const { anthropic } = await import("@workspace/integrations-anthropic-ai");

    const useTools = chatContext.mode === "general";
    const MAX_TURNS = 4;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const toolUseMap: Record<number, { id: string; name: string; json: string }> = {};
      let assistantText = "";

      const stream = anthropic.messages.stream({
        model: AI_CHAT_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: anthropicMessages,
        ...(useTools ? { tools: TOOLS_ANTHROPIC, tool_choice: { type: "auto" as const } } : {}),
      });

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          toolUseMap[event.index] = { id: event.content_block.id, name: event.content_block.name, json: "" };
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            assistantText += event.delta.text;
            sse({ delta: event.delta.text });
          } else if (event.delta.type === "input_json_delta") {
            if (toolUseMap[event.index]) toolUseMap[event.index].json += event.delta.partial_json;
          }
        }
      }

      const toolUseBlocks = Object.entries(toolUseMap).map(([, tu]) => tu);

      if (toolUseBlocks.length === 0) {
        break;
      }

      // Build assistant message with all content blocks for Anthropic format
      const assistantContent: any[] = [];
      if (assistantText) assistantContent.push({ type: "text", text: assistantText });
      for (const tu of toolUseBlocks) {
        let parsedInput: any = {};
        try { parsedInput = JSON.parse(tu.json || "{}"); } catch { parsedInput = {}; }
        assistantContent.push({ type: "tool_use", id: tu.id, name: tu.name, input: parsedInput });
      }
      anthropicMessages.push({ role: "assistant", content: assistantContent });

      // Execute each tool and collect results
      const toolResults: any[] = [];
      for (const tu of toolUseBlocks) {
        sse({ toolStatus: TOOL_STATUS_LABELS[tu.name] ?? "Veriler yükleniyor…" });

        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tu.json || "{}"); } catch { parsedArgs = {}; }

        let result: unknown;
        try {
          result = await executeTool(tu.name, parsedArgs, sse, businessId);
        } catch (toolErr) {
          logger.warn({ toolErr, tool: tu.name }, "Tool execution failed");
          result = { error: "Araç çalıştırılamadı." };
        }
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      anthropicMessages.push({ role: "user", content: toolResults });
    }

    // ── Proposal patch (proposal mode only) ─────────────────────────
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const shouldPatch =
      chatContext.mode === "proposal" &&
      chatContext.currentDraft &&
      detectsEditIntent(lastUserMessage);

    if (shouldPatch && chatContext.currentDraft) {
      try {
        const patchResponse = await anthropic.messages.create({
          model: AI_CHAT_MODEL,
          max_tokens: 2500,
          system: buildPatchSystemPrompt(chatContext),
          messages: [
            {
              role: "user",
              content: `Mevcut teklif taslağı:\n\n${chatContext.currentDraft}\n\nKullanıcı isteği: ${lastUserMessage}`,
            },
          ],
        });

        const patchBlock = patchResponse.content[0];
        const updatedDraft = patchBlock?.type === "text" ? patchBlock.text : "";
        if (updatedDraft) {
          sse({ proposalPatch: updatedDraft });
        }
      } catch (patchErr) {
        logger.warn({ patchErr }, "Failed to generate proposal patch — skipping");
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    logger.error({ err }, "AI chat error");
    if (!res.headersSent) {
      res.status(500).json({ error: "AI chat failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "AI yanıt hatası" })}\n\n`);
      res.end();
    }
  }
});

export default router;
