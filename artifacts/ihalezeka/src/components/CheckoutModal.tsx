import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  priceId?: string;
}

export function CheckoutModal({ open, onClose, priceId }: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startHostedCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${API_BASE}/billing/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, basePath }),
      });
      const data = (await res.json()) as { url?: string; error?: string; detail?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(
        data.error === "no_publishable_key"
          ? "Ödeme sistemi henüz yapılandırılmamış."
          : data.error === "no_price_configured"
            ? "Abonelik planı henüz hazır değil."
            : data.detail ?? "Ödeme başlatılamadı. Lütfen tekrar deneyin."
      );
    } catch {
      setError("Ödeme başlatılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [priceId]);

  useEffect(() => {
    if (open) {
      startHostedCheckout();
    }
  }, [open, startHostedCheckout]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader className="text-center">
          <DialogTitle className="font-heading text-lg">Pro Üyeliğe Geç</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Stripe ödeme sayfasına yönlendiriliyorsunuz…</p>
          </div>
        )}

        {error && !loading && (
          <div className="py-6 text-center text-sm text-destructive">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
