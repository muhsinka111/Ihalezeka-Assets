import { useEffect, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startCheckout } from "@/lib/billing";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  priceId?: string;
}

let stripePromiseCache: ReturnType<typeof loadStripe> | null = null;

async function getStripePublishableKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/billing/config`);
  if (!res.ok) return "";
  const data = (await res.json()) as { publishableKey?: string };
  return data.publishableKey ?? "";
}

async function getOrLoadStripe() {
  if (stripePromiseCache) return stripePromiseCache;
  const pk = await getStripePublishableKey();
  if (!pk) return null;
  stripePromiseCache = loadStripe(pk);
  return stripePromiseCache;
}

export function CheckoutModal({ open, onClose, priceId }: CheckoutModalProps) {
  const [stripePromise, setStripePromise] =
    useState<ReturnType<typeof loadStripe> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setError(null);
    setClientSecret(null);

    try {
      const stripe = await getOrLoadStripe();
      if (!stripe) {
        // No publishable key configured — fall back to redirect checkout
        setFallbackLoading(true);
        await startCheckout(priceId);
        onClose();
        setFallbackLoading(false);
        return;
      }
      setStripePromise(stripe);

      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${API_BASE}/billing/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, basePath }),
      });

      const data = (await res.json()) as {
        clientSecret?: string;
        error?: string;
      };

      if (!res.ok || data.error === "no_publishable_key") {
        // Backend says no publishable key → redirect checkout
        setFallbackLoading(true);
        await startCheckout(priceId);
        onClose();
        setFallbackLoading(false);
        return;
      }

      if (!data.clientSecret) {
        setError("Ödeme başlatılamadı. Lütfen tekrar deneyin.");
        return;
      }

      setClientSecret(data.clientSecret);
    } catch {
      setError("Ödeme başlatılamadı. Lütfen tekrar deneyin.");
      setFallbackLoading(false);
    }
  }, [priceId, onClose]);

  useEffect(() => {
    if (open) fetchSession();
    else {
      setClientSecret(null);
      setError(null);
    }
  }, [open, fetchSession]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-heading text-lg">Pro Üyeliğe Geç</DialogTitle>
        </DialogHeader>

        {fallbackLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Ödeme sayfasına yönlendiriliyorsunuz…
          </div>
        )}

        {error && !fallbackLoading && (
          <div className="px-6 py-8 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {!clientSecret && !error && !fallbackLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {clientSecret && stripePromise && (
          <div className="px-2 pb-4">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
