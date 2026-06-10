const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function postBilling(
  path: string,
  body: Record<string, unknown>,
): Promise<{ url?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, basePath }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error ?? `request_failed_${res.status}`);
  }
  return (await res.json()) as { url?: string };
}

/**
 * Start a Stripe Checkout session for the Pro subscription and redirect the
 * browser to it. `priceId` is optional — the backend resolves the default Pro
 * price when omitted.
 */
export async function startCheckout(priceId?: string): Promise<void> {
  const { url } = await postBilling("/billing/checkout", priceId ? { priceId } : {});
  if (url) window.location.href = url;
}

/** Open the Stripe billing portal so the user can manage or cancel Pro. */
export async function openBillingPortal(): Promise<void> {
  const { url } = await postBilling("/billing/portal", {});
  if (url) window.location.href = url;
}
