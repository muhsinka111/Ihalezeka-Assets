import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { IconAlertTriangle, IconCheck, IconCreditCard } from "@tabler/icons-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
}

const INTERVAL_TR: Record<string, string> = {
  month: "ay",
  year: "yıl",
  week: "hafta",
  day: "gün",
};

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "$99/ay";
  const major = amount / 100;
  const sym = currency === "usd" ? "$" : currency === "try" ? "₺" : currency === "eur" ? "€" : "";
  return `${sym}${major.toLocaleString("tr-TR")}`;
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SubscriptionManagement({ open, onClose }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ subscription: Subscription | null }>({
    queryKey: ["/api/billing/subscription"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/billing/subscription`);
      if (!res.ok) return { subscription: null };
      return (await res.json()) as { subscription: Subscription | null };
    },
    enabled: open,
    staleTime: 0,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/billing/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePath }),
      });
      if (!res.ok) throw new Error("cancel_failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/entitlement"] });
      toast.success("Aboneliğiniz dönem sonunda iptal edilecek.");
      setConfirmCancel(false);
    },
    onError: () => {
      toast.error("İptal işlemi başarısız. Lütfen tekrar deneyin.");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/billing/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePath }),
      });
      if (!res.ok) throw new Error("reactivate_failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/entitlement"] });
      toast.success("Aboneliğiniz yeniden aktifleştirildi!");
    },
    onError: () => {
      toast.error("Yeniden aktifleştirme başarısız. Lütfen tekrar deneyin.");
    },
  });

  const sub = data?.subscription;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Abonelik Yönetimi</DialogTitle>
            <DialogDescription>
              Pro üyeliğinizin detayları ve yönetim seçenekleri
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {!isLoading && !sub && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Aktif abonelik bulunamadı.
            </div>
          )}

          {!isLoading && sub && (
            <div className="space-y-4">
              {sub.cancelAtPeriodEnd && (
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                  <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Aboneliğiniz <strong>{formatDate(sub.currentPeriodEnd)}</strong> tarihinde sona erecek.
                  </span>
                </div>
              )}

              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold flex items-center gap-1.5">
                    <IconCheck className="h-4 w-4 text-emerald-500" />
                    Pro Plan
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ücret</span>
                  <span className="font-semibold">
                    {formatAmount(sub.amount, sub.currency)}
                    {sub.interval && (
                      <span className="font-normal text-muted-foreground">
                        /{INTERVAL_TR[sub.interval] ?? sub.interval}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {sub.cancelAtPeriodEnd ? "Bitiş tarihi" : "Sonraki ödeme"}
                  </span>
                  <span className="font-semibold">{formatDate(sub.currentPeriodEnd)}</span>
                </div>
                {sub.cardLast4 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ödeme yöntemi</span>
                    <span className="font-semibold flex items-center gap-1.5">
                      <IconCreditCard className="h-4 w-4" />
                      {sub.cardBrand ? `${sub.cardBrand.charAt(0).toUpperCase()}${sub.cardBrand.slice(1)} ` : ""}
                      •••• {sub.cardLast4}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {sub.cancelAtPeriodEnd ? (
                  <Button
                    className="w-full"
                    onClick={() => reactivateMutation.mutate()}
                    disabled={reactivateMutation.isPending}
                  >
                    {reactivateMutation.isPending ? "İşleniyor…" : "Aboneliği Yeniden Aktifleştir"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Aboneliği İptal Et
                  </Button>
                )}
                <Button variant="ghost" className="w-full text-sm" onClick={onClose}>
                  Kapat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Aboneliği iptal et?</DialogTitle>
            <DialogDescription>
              Pro üyeliğiniz mevcut dönem sonuna kadar aktif kalır. Dilediğiniz
              zaman yeniden aktifleştirebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-2">
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "İptal ediliyor…" : "Evet, iptal et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
