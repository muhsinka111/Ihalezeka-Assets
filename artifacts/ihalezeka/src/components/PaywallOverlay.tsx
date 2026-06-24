import React, { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconLock,
  IconBolt,
  IconCrown,
  IconSparkles,
  IconCircleCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { startCheckout } from "@/lib/billing";
import { useEntitlement } from "@/hooks/useEntitlement";
import { cn } from "@/lib/utils";

/** Map a billing error code to a friendly Turkish message. */
function checkoutErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "no_price_configured") {
    return "Abonelik planı henüz hazır değil. Lütfen daha sonra tekrar deneyin.";
  }
  if (code === "auth_required") {
    return "Devam etmek için lütfen giriş yapın.";
  }
  return "Ödeme başlatılamadı. Lütfen tekrar deneyin.";
}

/** Primary "upgrade to Pro" button that kicks off Stripe Checkout. */
export function UpgradeButton({
  className,
  size = "default",
  variant = "default",
  label = "Pro'ya Yükselt",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await startCheckout();
    } catch (err) {
      toast.error(checkoutErrorMessage(err));
      setLoading(false);
    }
  };
  return (
    <Button onClick={onClick} disabled={loading} size={size} variant={variant} className={cn("gap-2", className)}>
      <IconBolt className="h-4 w-4" />
      {loading ? "Yönlendiriliyor…" : label}
    </Button>
  );
}

/** Tiny lock pill shown next to premium navigation items. */
export function ProLockBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/20 text-amber-500 shrink-0",
        className,
      )}
      title="Pro özelliği"
    >
      <IconLock className="h-2.5 w-2.5" />
    </span>
  );
}

/**
 * Locked teaser for a single premium section on an otherwise-free page (e.g.
 * the AI analysis / contact / documents blocks on the tender detail page).
 */
export function PaywallCard({
  icon: Icon = IconSparkles,
  title,
  description,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2D5BFF] shadow-sm">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <IconLock className="h-3.5 w-3.5 text-amber-500" />
            <h3 className="font-heading text-sm font-semibold">{title}</h3>
          </div>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <UpgradeButton size="sm" />
          <Link href="/fiyatlandirma">
            <Button size="sm" variant="outline">Planları Gör</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Full-width banner shown on the tender detail page when a free user has
 * exhausted their 2 included AI analysis credits.
 */
export function CreditsExhaustedBanner() {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <IconAlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900 text-sm">Ücretsiz analiz haklarınız bitti</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            2 ücretsiz yapay zeka analizinizi kullandınız. Sınırsız analiz, ihale belgeleri, belgelerle sohbet ve daha fazlası için Pro'ya geçin.
          </p>
        </div>
        <UpgradeButton size="sm" className="shrink-0" label="Pro'ya Geç — ₺99/ay" />
      </CardContent>
    </Card>
  );
}

const DEFAULT_PRO_FEATURES = [
  "Tüm ihalelerde yapay zeka uygunluk analizi",
  "Tam ilan metni, belgeler ve iletişim bilgileri",
  "Pipeline, teklif oluşturucu ve rakip analizi",
  "Kayıtlı arama uyarıları ve raporlar",
];

/**
 * Full-page gate for premium-only pages. Renders the children for Pro users,
 * otherwise a full upgrade screen. Designed to live inside the AppShell.
 */
export function RequirePro({
  title,
  description,
  features = DEFAULT_PRO_FEATURES,
  children,
}: {
  title: string;
  description: string;
  features?: string[];
  children: React.ReactNode;
}) {
  const { isPro, isLoading } = useEntitlement();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isPro) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="bg-[#1B2C50] px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <IconCrown className="h-6 w-6 text-yellow-300" />
          </div>
          <h1 className="font-heading text-xl font-bold">{title}</h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-white/80">{description}</p>
        </div>
        <CardContent className="space-y-5 px-6 py-6">
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <UpgradeButton className="flex-1" />
            <Link href="/fiyatlandirma" className="flex-1">
              <Button variant="outline" className="w-full">Planları Karşılaştır</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
