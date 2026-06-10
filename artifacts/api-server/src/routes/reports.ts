import { Router } from "express";
import { requirePro } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: reports & exports (Raporlar) are a Pro power tool.
router.use("/reports", requirePro);

router.get("/reports/summary", async (req, res) => {
  res.json({
    totalApplications: 60,
    wonCount: 23,
    lostCount: 28,
    pendingCount: 9,
    successRate: 38.3,
    totalWonValue: 18_750_000,
    aiSummary: "2025 yılı performans analizi: Toplam 60 ihale başvurusunda %38,3 başarı oranına ulaştınız. En güçlü performansınız Danışmanlık ve BT Hizmetleri segmentlerinde gösterildi. Yapım işlerinde rakipler genellikle %5-8 daha düşük fiyat teklifleri sunuyor — bu segmentte teknik yeterlilik ve iş deneyimi belgelerini ön plana çıkarmanızı öneririz. Q3'te açılması beklenen 3 büyük kamu altyapı ihalesi için hazırlık başlatılması önerilir.",
  });
});

router.get("/reports/applications-chart", async (req, res) => {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const apps =   [3, 4, 5, 4, 6, 7, 5, 4, 6, 7, 5, 4];
  const wins =   [1, 2, 2, 1, 2, 3, 2, 2, 2, 3, 2, 1];
  res.json(months.map((month, i) => ({ month, applications: apps[i], wins: wins[i] })));
});

router.get("/reports/category-performance", async (req, res) => {
  res.json([
    { category: "Yapım İşleri", applications: 24, wins: 8, winRate: 33.3 },
    { category: "Hizmet Alımı", applications: 18, wins: 7, winRate: 38.9 },
    { category: "Mal Alımı", applications: 12, wins: 5, winRate: 41.7 },
    { category: "BT Hizmetleri", applications: 10, wins: 6, winRate: 60.0 },
    { category: "Danışmanlık", applications: 6, wins: 3, winRate: 50.0 },
  ]);
});

export default router;
