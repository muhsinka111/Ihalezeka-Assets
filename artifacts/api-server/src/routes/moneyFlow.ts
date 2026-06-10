import { Router } from "express";
import { requirePro } from "../lib/authHelpers.js";

const router = Router();

// Premium-only: cash-flow analytics (Para Akışı) is a Pro power tool.
router.use("/money-flow", requirePro);

router.get("/money-flow/monthly", async (req, res) => {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const base = [8.2, 6.1, 9.4, 11.2, 10.8, 14.3, 12.1, 9.7, 15.6, 18.2, 16.4, 22.1];
  res.json(months.map((month, i) => ({ month, amount: base[i] * 1_000_000 })));
});

router.get("/money-flow/categories", async (req, res) => {
  res.json([
    { category: "Yapım İşleri", amount: 48_000_000, percentage: 38.4 },
    { category: "Hizmet Alımı", amount: 31_500_000, percentage: 25.2 },
    { category: "Mal Alımı", amount: 24_000_000, percentage: 19.2 },
    { category: "BT Hizmetleri", amount: 14_500_000, percentage: 11.6 },
    { category: "Diğer", amount: 7_000_000, percentage: 5.6 },
  ]);
});

router.get("/money-flow/top-agencies", async (req, res) => {
  res.json([
    { agencyName: "Sağlık Bakanlığı", agencyLogoUrl: null, totalSpend: 22_500_000, tenderCount: 45, il: "Ankara" },
    { agencyName: "MEB Genel Müdürlüğü", agencyLogoUrl: null, totalSpend: 18_200_000, tenderCount: 38, il: "Ankara" },
    { agencyName: "İstanbul Büyükşehir Belediyesi", agencyLogoUrl: null, totalSpend: 15_800_000, tenderCount: 31, il: "İstanbul" },
    { agencyName: "Ulaştırma ve Alt Yapı Bakanlığı", agencyLogoUrl: null, totalSpend: 14_100_000, tenderCount: 27, il: "Ankara" },
    { agencyName: "Çevre ve Şehircilik Bakanlığı", agencyLogoUrl: null, totalSpend: 12_400_000, tenderCount: 24, il: "Ankara" },
    { agencyName: "Ankara Büyükşehir Belediyesi", agencyLogoUrl: null, totalSpend: 9_800_000, tenderCount: 20, il: "Ankara" },
    { agencyName: "İzmir Büyükşehir Belediyesi", agencyLogoUrl: null, totalSpend: 8_200_000, tenderCount: 17, il: "İzmir" },
    { agencyName: "Hazine ve Maliye Bakanlığı", agencyLogoUrl: null, totalSpend: 6_900_000, tenderCount: 14, il: "Ankara" },
  ]);
});

export default router;
