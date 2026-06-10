import { Router } from "express";
import { db } from "@workspace/db";
import { competitorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePro } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: competitor analysis (Rakip Analizi) is a Pro power tool.
router.use("/competitors", requirePro);
const DEFAULT_BIZ = "demo-business";

router.get("/competitors", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(competitorsTable)
      .where(eq(competitorsTable.businessId, DEFAULT_BIZ));
    res.json(items);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/competitors/insights", async (req, res) => {
  try {
    res.json({
      aiInsight: "Rakip analizi: Sektördeki en güçlü rakibiniz Teknik Yapı A.Ş., inşaat ihalelerinde ortalama %18 kırım uygulayarak son 6 ayda 12 ihale kazandı. Temizlik hizmetleri segmentinde ise Güven Hizmetler Ltd., düşük kırım oranıyla yüksek kalite üzerine konumlanmış. Bu segmentte fiyat odaklı bir strateji yerine teknik kapasite öne çıkarılmalı.",
      categoryWinRates: [
        { category: "Yapım İşleri", applications: 24, wins: 8, winRate: 33.3 },
        { category: "Hizmet Alımı", applications: 18, wins: 7, winRate: 38.9 },
        { category: "Mal Alımı", applications: 12, wins: 5, winRate: 41.7 },
        { category: "Danışmanlık", applications: 6, wins: 3, winRate: 50.0 },
      ],
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
