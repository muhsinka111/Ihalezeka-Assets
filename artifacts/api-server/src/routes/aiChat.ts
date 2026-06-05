import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, tendersTable, companyProfilesTable, pipelineItemsTable } from "@workspace/db";
import { eq, desc, and, or, gte, isNull, ilike, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

const DEFAULT_BIZ = "demo-business";

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
  const base = `Sen İhaleZeka'nın yapay zeka asistanısın. İhaleZeka, Türkiye'deki şirketlerin devlet ihalelerini takip etmesini, teklif hazırlamasını ve rekabet analizleri yapmasını sağlayan bir SaaS platformudur.

Görevin kullanıcıya ihaleler, başvuru süreçleri, teklifler ve stratejiler konusunda pratik, doğrudan ve uzman tavsiyesi vermektir. Her zaman Türkçe yanıt ver. Kısa ve net ol — gereksiz giriş cümleleri kullanma. Mümkün olduğunda liste ve başlık kullan.

Sen bir AJAN'sın: Kullanıcı ihale aramak, fırsatlarını görmek, yaklaşan son tarihleri öğrenmek veya bir ihaleyi takip listesine (pipeline) eklemek istediğinde, sana verilen araçları (tools) KULLAN. Tahmin etme — gerçek verileri araçlarla çek. Araç sonuçlarındaki ihaleleri kullanıcıya kısaca özetle; arayüz ihale kartlarını otomatik gösterecek, bu yüzden tüm alanları tekrar yazma.`;

  if (context.mode === "general") {
    const matchesSummary =
      context.topMatches && context.topMatches.length > 0
        ? `\n\nKullanıcının En İyi Fırsatları:\n` +
          context.topMatches
            .slice(0, 5)
            .map(
              (m) =>
                `- ${m.title} (${m.agency}) — Uyum Skoru: %${m.fitScore}${
                  m.deadline
                    ? `, Son Tarih: ${new Date(m.deadline).toLocaleDateString("tr-TR")}`
                    : ""
                }`
            )
            .join("\n")
        : "";

    const companySummary = context.companyName
      ? `\nŞirket: ${context.companyName}`
      : "";

    const briefSummary = context.aiBrief
      ? `\n\nFirma Hakkında (kullanıcı tarafından yazılmış):\n${context.aiBrief}`
      : "";

    return `${base}${companySummary}${briefSummary}${matchesSummary}

Kullanıcı kendi ihaleleri, fırsatları veya platformdaki veriler hakkında soru soruyorsa araçları kullanarak gerçek verileri çek. Eğer araçtan sonuç gelmezse bunu açıkça belirt.`;
  }

  if (context.mode === "proposal") {
    const t = context.tender;
    const tenderInfo = t
      ? `\n\nAktif İhale:\n- Başlık: ${t.title ?? "Belirtilmemiş"}\n- Kurum: ${t.agency ?? "Belirtilmemiş"}\n- Tür: ${t.type ?? "Belirtilmemiş"}\n- Tahmini Bedel: ${t.estimatedValue ? t.estimatedValue.toLocaleString("tr-TR") + " TL" : "Belirtilmemiş"}\n- Son Tarih: ${t.deadline ? new Date(t.deadline).toLocaleDateString("tr-TR") : "Belirtilmemiş"}${t.aiSummary ? `\n- Belge Özeti: ${t.aiSummary}` : ""}`
      : "";

    const briefSummary = context.aiBrief
      ? `\n\nFirma Hakkında:\n${context.aiBrief}`
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

  return `Sen profesyonel bir teklif yazarısın. Kullanıcının isteğine göre mevcut teklif taslağını güncelleyeceksin.${tenderInfo}

Kurallar:
- Mevcut taslağı tamamen koru, yalnızca istenen bölümü değiştir veya ekle.
- Yalnızca güncellenmiş teklif metnini döndür — başka hiçbir şey ekleme, açıklama yapma.
- Formatı (markdown başlıklar, listeler vb.) koru.
- Türkçe yaz.`;
}

// ── Agent tools ────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_tenders",
      description:
        "Türkiye kamu ihale veritabanında aktif (süresi geçmemiş) ihaleleri arar. Kullanıcı bir konu, anahtar kelime, şehir veya ihale türü için ihale aramak istediğinde kullan.",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "İhale başlığı veya kurum adında aranacak anahtar kelime (ör. 'yazılım', 'inşaat', 'tıbbi cihaz').",
          },
          il: { type: "string", description: "İhalenin yapılacağı il (ör. 'Ankara', 'İstanbul')." },
          type: { type: "string", description: "İhale türü: 'Mal', 'Hizmet' veya 'Yapım'." },
          limit: { type: "number", description: "Döndürülecek en fazla ihale sayısı (varsayılan 8)." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_matches",
      description:
        "Kullanıcının firma profiline göre en yüksek uyum skoruna sahip ihale fırsatlarını döndürür. Kullanıcı 'bana uygun ihaleler', 'en iyi fırsatlarım' gibi şeyler sorduğunda kullan.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Döndürülecek en fazla fırsat sayısı (varsayılan 6)." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_upcoming_deadlines",
      description:
        "Son başvuru tarihi en yakın olan aktif ihaleleri döndürür. Kullanıcı yaklaşan son tarihleri sorduğunda kullan.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Döndürülecek en fazla ihale sayısı (varsayılan 6)." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_pipeline",
      description:
        "Belirtilen ihaleyi kullanıcının takip listesine (pipeline) ekler. Kullanıcı bir ihaleyi takip etmek/pipeline'a eklemek istediğinde kullan. tenderId, search_tenders veya get_top_matches sonuçlarından alınmalıdır.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "number", description: "Pipeline'a eklenecek ihalenin sayısal ID'si." },
        },
        required: ["tenderId"],
      },
    },
  },
];

function serializeTender(t: typeof tendersTable.$inferSelect) {
  return {
    id: t.id,
    title: t.title,
    agency: t.agencyName,
    agencyLogoUrl: t.agencyLogoUrl,
    type: t.type,
    il: t.il,
    estimatedValue: t.estimatedValue,
    deadline: t.deadline?.toISOString() ?? null,
    sourceSystem: t.sourceSystem,
  };
}

async function runSearchTenders(args: { keyword?: string; il?: string; type?: string; limit?: number }) {
  const limit = Math.min(args.limit ?? 8, 12);
  const now = new Date();
  const conditions = [
    or(gte(tendersTable.deadline, now), isNull(tendersTable.deadline))!,
    eq(tendersTable.status, "active"),
  ];
  if (args.keyword) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${args.keyword}%`),
        ilike(tendersTable.agencyName, `%${args.keyword}%`)
      )!
    );
  }
  if (args.il) conditions.push(ilike(tendersTable.il, `%${args.il}%`));
  if (args.type) conditions.push(ilike(tendersTable.type, `%${args.type}%`));

  const rows = await db
    .select()
    .from(tendersTable)
    .where(and(...conditions))
    .orderBy(sql`${tendersTable.deadline} ASC NULLS LAST`)
    .limit(limit);

  return rows.map(serializeTender);
}

async function runGetTopMatches(args: { limit?: number }) {
  const limit = Math.min(args.limit ?? 6, 10);
  const rows = await db
    .select()
    .from(matchesTable)
    .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
    .where(eq(matchesTable.businessId, DEFAULT_BIZ))
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

async function runAddToPipeline(args: { tenderId: number }) {
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
        eq(pipelineItemsTable.businessId, DEFAULT_BIZ),
        eq(pipelineItemsTable.tenderId, args.tenderId)
      )
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, alreadyExists: true, message: `"${tender.title}" zaten takip listenizde.`, tender: serializeTender(tender) };
  }
  await db.insert(pipelineItemsTable).values({
    businessId: DEFAULT_BIZ,
    tenderId: args.tenderId,
    stage: "discovery",
  });
  return { ok: true, message: `"${tender.title}" takip listenize (Fırsat Keşfi) eklendi.`, tender: serializeTender(tender) };
}

async function executeTool(name: string, args: any, sse: (obj: unknown) => void) {
  switch (name) {
    case "search_tenders": {
      const results = await runSearchTenders(args);
      if (results.length) sse({ tenders: results });
      return { count: results.length, tenders: results };
    }
    case "get_top_matches": {
      const results = await runGetTopMatches(args);
      if (results.length) sse({ tenders: results });
      return { count: results.length, matches: results };
    }
    case "get_upcoming_deadlines": {
      const results = await runGetUpcomingDeadlines(args);
      if (results.length) sse({ tenders: results });
      return { count: results.length, tenders: results };
    }
    case "add_to_pipeline": {
      const result = await runAddToPipeline(args);
      sse({ action: { type: "pipeline_added", ok: result.ok, message: result.message } });
      return result;
    }
    default:
      return { error: `Bilinmeyen araç: ${name}` };
  }
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
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

    // Always fetch company profile so aiBrief is injected in every mode.
    if (!chatContext.aiBrief) {
      try {
        const profileFetch = db
          .select()
          .from(companyProfilesTable)
          .where(eq(companyProfilesTable.businessId, DEFAULT_BIZ))
          .limit(1);

        if (chatContext.mode === "general" && !chatContext.topMatches) {
          const [rows, profileRows] = await Promise.all([
            db
              .select()
              .from(matchesTable)
              .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
              .where(eq(matchesTable.businessId, DEFAULT_BIZ))
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

    const conversation: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-12),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sse = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    const { openai } = await import("@workspace/integrations-openai-ai-server");

    // Only the general mode uses the agentic tools. Proposal mode stays focused on writing.
    const useTools = chatContext.mode === "general";
    const MAX_TURNS = 4;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversation,
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
        ...(useTools ? { tools: TOOLS, tool_choice: "auto" } : {}),
      });

      let assistantText = "";
      const toolAcc: Record<number, AccumulatedToolCall> = {};

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          sse({ delta: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolAcc[idx]) toolAcc[idx] = { id: "", name: "", arguments: "" };
            if (tc.id) toolAcc[idx].id = tc.id;
            if (tc.function?.name) toolAcc[idx].name = tc.function.name;
            if (tc.function?.arguments) toolAcc[idx].arguments += tc.function.arguments;
          }
        }
      }

      const toolCalls = Object.values(toolAcc).filter((t) => t.name);

      if (toolCalls.length === 0) {
        // No tools requested — the streamed text is the final answer.
        break;
      }

      // Record the assistant's tool-call turn, then execute each tool.
      conversation.push({
        role: "assistant",
        content: assistantText || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: "function",
          function: { name: t.name, arguments: t.arguments || "{}" },
        })),
      });

      for (const call of toolCalls) {
        let parsedArgs: any = {};
        try {
          parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          parsedArgs = {};
        }
        let result: unknown;
        try {
          result = await executeTool(call.name, parsedArgs, sse);
        } catch (toolErr) {
          logger.warn({ toolErr, tool: call.name }, "Tool execution failed");
          result = { error: "Araç çalıştırılamadı." };
        }
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      // Loop again so the model can summarize tool results (and possibly chain tools).
    }

    // ── Proposal patch (proposal mode only) ─────────────────────────
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const shouldPatch =
      chatContext.mode === "proposal" &&
      chatContext.currentDraft &&
      detectsEditIntent(lastUserMessage);

    if (shouldPatch && chatContext.currentDraft) {
      try {
        const patchMessages = [
          { role: "system" as const, content: buildPatchSystemPrompt(chatContext) },
          {
            role: "user" as const,
            content: `Mevcut teklif taslağı:\n\n${chatContext.currentDraft}\n\nKullanıcı isteği: ${lastUserMessage}`,
          },
        ];

        const patchResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: patchMessages as any,
          stream: false,
          max_tokens: 2048,
          temperature: 0.4,
        });

        const updatedDraft = patchResponse.choices[0]?.message?.content ?? "";
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
