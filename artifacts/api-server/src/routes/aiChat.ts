import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, tendersTable, companyProfilesTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
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
}

function buildSystemPrompt(context: ChatContext): string {
  const base = `Sen İhaleZeka'nın yapay zeka asistanısın. İhaleZeka, Türkiye'deki şirketlerin devlet ihalelerini takip etmesini, teklif hazırlamasını ve rekabet analizleri yapmasını sağlayan bir SaaS platformudur.

Görevin kullanıcıya ihaleler, başvuru süreçleri, teklifler ve stratejiler konusunda pratik, doğrudan ve uzman tavsiyesi vermektir. Her zaman Türkçe yanıt ver. Kısa ve net ol — gereksiz giriş cümleleri kullanma. Mümkün olduğunda liste ve başlık kullan.`;

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

    return `${base}${companySummary}${matchesSummary}

Kullanıcı kendi ihaleleri, fırsatları veya platformdaki veriler hakkında soru soruyorsa yukarıdaki bilgileri kullan. Eğer bilgin yoksa bunu açıkça belirt.`;
  }

  if (context.mode === "proposal") {
    const t = context.tender;
    const tenderInfo = t
      ? `\n\nAktif İhale:\n- Başlık: ${t.title ?? "Belirtilmemiş"}\n- Kurum: ${t.agency ?? "Belirtilmemiş"}\n- Tür: ${t.type ?? "Belirtilmemiş"}\n- Tahmini Bedel: ${t.estimatedValue ? t.estimatedValue.toLocaleString("tr-TR") + " TL" : "Belirtilmemiş"}\n- Son Tarih: ${t.deadline ? new Date(t.deadline).toLocaleDateString("tr-TR") : "Belirtilmemiş"}${t.aiSummary ? `\n- Belge Özeti: ${t.aiSummary}` : ""}`
      : "";

    return `${base}

Kullanıcı şu anda bir ihale için teklif mektubu hazırlıyor. Teknik yaklaşım, fiyatlandırma stratejisi, referans projeler ve şartname gereksinimleri konularında yardım et. Önerilerini doğrudan teklif metnine dahil edilebilecek şekilde yaz.${tenderInfo}`;
  }

  return base;
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

    if (chatContext.mode === "general" && !chatContext.topMatches) {
      try {
        const [rows, profileRows] = await Promise.all([
          db
            .select()
            .from(matchesTable)
            .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
            .where(eq(matchesTable.businessId, DEFAULT_BIZ))
            .orderBy(desc(matchesTable.fitScore))
            .limit(6),
          db
            .select()
            .from(companyProfilesTable)
            .where(eq(companyProfilesTable.businessId, DEFAULT_BIZ))
            .limit(1),
        ]);

        chatContext.topMatches = rows.map((r) => ({
          title: r.tenders.title,
          agency: r.tenders.agencyName,
          fitScore: r.matches.fitScore,
          deadline: r.tenders.deadline?.toISOString() ?? null,
        }));

        if (profileRows[0]) {
          chatContext.companyName = profileRows[0].companyName;
        }
      } catch (err) {
        logger.warn({ err }, "Failed to fetch context for AI chat — continuing without it");
      }
    }

    const systemPrompt = buildSystemPrompt(chatContext);

    const openaiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-12),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages as any,
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
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
