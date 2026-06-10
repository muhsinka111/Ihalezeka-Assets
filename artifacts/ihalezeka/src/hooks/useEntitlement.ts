import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type Plan = "free" | "pro";

/** Query key for the current user's entitlement. Kept as a constant so the
 *  checkout-success flow in AppShell can write fresh data into the cache. */
export const ENTITLEMENT_KEY = ["/api/billing/entitlement"] as const;

/**
 * Resolve the current user's plan from the backend. Fails closed to "free" so
 * the UI never accidentally unlocks premium features on a network error.
 */
export function useEntitlement() {
  const query = useQuery<{ plan: Plan }>({
    queryKey: ENTITLEMENT_KEY,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/billing/entitlement`);
      if (!res.ok) return { plan: "free" as Plan };
      return (await res.json()) as { plan: Plan };
    },
    staleTime: 30_000,
  });

  const plan: Plan = query.data?.plan ?? "free";
  return {
    plan,
    isPro: plan === "pro",
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
