import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconCheck,
  IconBolt,
  IconCrown,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { startCheckout, openBillingPortal } from "@/lib/billing";
import { useEntitlement } from "@/hooks/useEntitlement";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface BillingPrice {
  id: string;
  unitAmount: number | null;
  currency: string;
  recurring: { interval?: string } | null;
}
interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  prices: BillingPrice[];
}

const FREE_FEATURES = [
  "Tüm kaynaklarda ihale arama (EKAP ve daha fazlası)",
  "İhale listeleri ve kart görünümü",
  "Temel ihale detayları ve kısa özet",
  "Kaynak bağlantısı ile resmi ilana erişim",
];

const PRO_FEATURES = [
  "Tam ilan metni, belgeler ve iletişim bilgileri",
  "Yapay zeka uygunluk analizi (skor, artılar, riskler, kriterler)",
  "Doküman sohbeti ile ihale belgelerini sorgulama",
  "Boru hattı, teklif oluşturucu ve başvuru sihirbazı",
  "Rakip analizi, para akışı ve raporlar",
  "Kayıtlı arama uyarıları ve dışa aktarma",
];

const INTERVAL_LABEL: Record<string, string> = {
  month: "ay",
  year: "yıl",
  week: "hafta",
  day: "gün",
};

/** Format a Stripe price (minor units) into a Turkish lira string. */
function formatPrice(price: BillingPrice | null): { amount: string; interval: string } {
  if (!price || price.unitAmount == null) return { amount: "₺499", interval: "ay" };
  const major = price.unitAmount / 100;
  const symbol = price.currency?.toLowerCase() === "try" ? "₺" : "";
  const amount = `${symbol}${major.toLocaleString("tr-TR")}`;
  const interval = INTERVAL_LABEL[price.recurring?.interval ?? "month"] ?? "ay";
  return { amount, interval };
}

export default function FiyatlandirmaPage() {
  const { isPro } = useEntitlement();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data } = useQuery<{ data: BillingProduct[] }>({
    queryKey: ["/api/billing/products"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/billing/products`);
      if (!res.ok) return { data: [] };
      return (await res.json()) as { data: BillingProduct[] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const proProduct = data?.data?.[0] ?? null;
  const proPrice = proProduct?.prices?.[0] ?? null;
  const { amount, interval } = formatPrice(proPrice);

  const handleUpgrade = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      await startCheckout(proPrice?.id);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      toast.error(
        code === "no_price_configured"
          ? "Abonelik planı henüz hazır değil. Lütfen daha sonra tekrar deneyin."
          : "Ödeme başlatılamadı. Lütfen tekrar deneyin.",
      );
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      await openBillingPortal();
    } catch {
      toast.error("Abonelik yönetimi açılamadı. Lütfen tekrar deneyin.");
      setPortalLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Size uygun planı seçin</h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Arama her zaman ücretsiz. Kazanmanızı sağlayan zekâ — analiz, belgeler ve araçlar — Pro
          planında.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free plan */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <IconSearch className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold">Ücretsiz</h2>
                <p className="text-xs text-muted-foreground">Aramaya hemen başlayın</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">₺0</span>
              <span className="text-sm text-muted-foreground">/ ay</span>
            </div>
            <ul className="flex-1 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>
              {isPro ? "Mevcut taban plan" : "Mevcut planınız"}
            </Button>
          </CardContent>
        </Card>

        {/* Pro plan */}
        <Card className={cn("relative flex flex-col overflow-hidden", !isPro && "ring-2 ring-primary")}>
          <div className="absolute right-4 top-4">
            <Badge className="gap-1 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <IconCrown className="h-3 w-3 text-yellow-300" /> Önerilen
            </Badge>
          </div>
          <CardContent className="flex flex-1 flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600">
                <IconBolt className="h-5 w-5 text-yellow-300" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold">Pro</h2>
                <p className="text-xs text-muted-foreground">Kazanmak için tam donanım</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{amount}</span>
              <span className="text-sm text-muted-foreground">/ {interval}</span>
            </div>
            <ul className="flex-1 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isPro ? (
              <Button variant="outline" className="w-full gap-2" onClick={handleManage} disabled={portalLoading}>
                <IconSettings className="h-4 w-4" />
                {portalLoading ? "Açılıyor…" : "Aboneliği Yönet"}
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={handleUpgrade} disabled={checkoutLoading}>
                <IconBolt className="h-4 w-4" />
                {checkoutLoading ? "Yönlendiriliyor…" : "Pro'ya Yükselt"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        İstediğiniz zaman iptal edebilirsiniz. Ödemeler Stripe ile güvenli şekilde işlenir.
      </p>
    </div>
  );
}
