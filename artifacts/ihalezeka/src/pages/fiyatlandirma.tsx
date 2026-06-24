import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconCheck,
  IconBolt,
  IconSettings,
  IconArrowRight,
  IconShieldCheck,
} from "@tabler/icons-react";
import { startCheckout, openBillingPortal } from "@/lib/billing";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";

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

const PRO_FEATURES = [
  "Sınırsız ihale araması (EKAP, İlan.gov ve daha fazlası)",
  "Yapay zeka uygunluk analizi — skor, artılar, riskler",
  "Şartname doküman sohbeti",
  "Pipeline ve teklif oluşturucu",
  "Rakip analizi ve para akışı raporları",
  "Kayıtlı arama uyarıları ve dışa aktarma",
  "Uygunluk analizi ve belge yönetimi",
];

const INTERVAL_LABEL: Record<string, string> = {
  month: "ay",
  year: "yıl",
  week: "hafta",
  day: "gün",
};

function formatPrice(price: BillingPrice | null): { amount: string; interval: string } {
  if (!price || price.unitAmount == null) return { amount: "$99", interval: "ay" };
  const major = price.unitAmount / 100;
  const currency = price.currency?.toLowerCase();
  let symbol = "";
  if (currency === "try") symbol = "₺";
  else if (currency === "usd") symbol = "$";
  else if (currency === "eur") symbol = "€";
  const amount = `${symbol}${major.toLocaleString("tr-TR")}`;
  const interval = INTERVAL_LABEL[price.recurring?.interval ?? "month"] ?? "ay";
  return { amount, interval };
}

export default function FiyatlandirmaPage() {
  const { isPro } = useEntitlement();
  const { isSignedIn } = useAuth();
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
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Pro Plan</h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          İhaleZeka'nın tüm gücü — yapay zeka analizi, belgeler, pipeline ve araçlar — tek planda.
        </p>
      </div>

      <Card className="relative overflow-hidden border-2 border-primary shadow-xl shadow-primary/10">
        {/* Top accent */}
        <div className="h-1.5 bg-[#2D5BFF]" />

        <CardContent className="flex flex-col gap-6 p-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2D5BFF] shadow-lg shadow-primary/30">
              <IconBolt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold">Pro Plan</h2>
              <p className="text-xs text-muted-foreground">Kazanmak için tam donanım</p>
            </div>
          </div>

          {/* Price */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold">{amount}</span>
              <span className="text-base text-muted-foreground font-medium">/ {interval}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              İstediğiniz zaman iptal edebilirsiniz
            </p>
          </div>

          {/* CTA */}
          {isPro ? (
            <Button
              variant="outline"
              className="w-full gap-2 h-12"
              onClick={handleManage}
              disabled={portalLoading}
            >
              <IconSettings className="h-4 w-4" />
              {portalLoading ? "Açılıyor…" : "Aboneliği Yönet"}
            </Button>
          ) : isSignedIn ? (
            <Button
              className="w-full gap-2 h-12 text-base font-bold shadow-lg shadow-primary/20"
              onClick={handleUpgrade}
              disabled={checkoutLoading}
            >
              <IconBolt className="h-4 w-4" />
              {checkoutLoading ? "Yönlendiriliyor…" : "Pro'ya Geç"}
            </Button>
          ) : (
            <Link href="/sign-up">
              <Button className="w-full gap-2 h-12 text-base font-bold shadow-lg shadow-primary/20">
                <IconArrowRight className="h-5 w-5" />
                Hemen Başla
              </Button>
            </Link>
          )}

          {/* Features */}
          <ul className="space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <IconCheck className="h-3 w-3 text-primary" />
                </div>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <IconShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        Ödemeler Stripe ile güvenli şekilde işlenir
      </div>
    </div>
  );
}
