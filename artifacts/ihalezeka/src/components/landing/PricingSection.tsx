import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  IconCheck,
  IconBolt,
  IconArrowRight,
  IconLock,
  IconShieldCheck,
  IconSettings,
} from "@tabler/icons-react";
import { useAuth } from "@clerk/react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { startCheckout, openBillingPortal } from "@/lib/billing";
import { toast } from "sonner";

const FEATURES = [
  "Sınırsız ihale araması (EKAP, İlan.gov ve daha fazlası)",
  "Yapay zeka uygunluk analizi — skor, artılar, riskler",
  "Şartname doküman sohbeti",
  "Boru hattı ve teklif oluşturucu",
  "Rakip analizi ve para akışı raporları",
  "Kayıtlı arama uyarıları ve dışa aktarma",
  "Başvuru sihirbazı ve belge yönetimi",
];

export function PricingSection() {
  const { isSignedIn } = useAuth();
  const { isPro } = useEntitlement();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      await startCheckout(undefined);
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
    <section id="fiyatlandirma" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mb-5">
            <IconLock className="h-3.5 w-3.5" />
            FİYATLANDIRMA
          </div>
          <h2 className="text-3xl md:text-5xl font-heading font-extrabold mb-5 text-foreground tracking-tight leading-[1.12]">
            Tek plan.{" "}
            <span className="text-[#2D5BFF]">
              Her şey dahil.
            </span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Karmaşık katmanlar yok. İhaleZeka'nın tüm gücüne aylık sabit bir fiyatla erişin.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="max-w-md mx-auto"
        >
          <div className="relative rounded-3xl border-2 border-primary bg-card shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1.5 bg-[#2D5BFF]" />

            <div className="p-8 md:p-10">
              {/* Icon + name */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-[#2D5BFF] flex items-center justify-center shadow-lg shadow-primary/30">
                  <IconBolt className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-foreground">Pro Plan</h3>
                  <p className="text-sm text-muted-foreground">Kazanmak için tam donanım</p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-extrabold text-foreground">$99</span>
                <span className="text-muted-foreground text-base font-medium">/ ay</span>
              </div>
              <p className="text-xs text-muted-foreground mb-8">
                USD olarak faturalandırılır · istediğiniz zaman iptal
              </p>

              {/* CTA — auth-aware */}
              {isPro ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 h-13 text-base font-bold mb-8"
                  onClick={handleManage}
                  disabled={portalLoading}
                >
                  <IconSettings className="h-5 w-5" />
                  {portalLoading ? "Açılıyor…" : "Aboneliği Yönet"}
                </Button>
              ) : isSignedIn ? (
                <Button
                  size="lg"
                  className="w-full gap-2 h-13 text-base font-bold shadow-lg shadow-primary/20 mb-8"
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                >
                  <IconBolt className="h-5 w-5" />
                  {checkoutLoading ? "Yönlendiriliyor…" : "Pro'ya Geç"}
                </Button>
              ) : (
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="w-full gap-2 h-13 text-base font-bold shadow-lg shadow-primary/20 mb-8"
                  >
                    <IconArrowRight className="h-5 w-5" />
                    Hemen Başla
                  </Button>
                </Link>
              )}

              {/* Features */}
              <ul className="space-y-3">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <IconCheck className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 text-sm text-muted-foreground shadow-sm">
            <IconShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            Ödemeler Stripe ile güvenle işlenir · 500+ firma kullanıyor
          </div>
        </motion.div>
      </div>
    </section>
  );
}
