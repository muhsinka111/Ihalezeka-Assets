import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useAiPanelStore } from "@/store/aiPanelStore";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AgencyLogo } from "@/components/AgencyLogo";
import { NotificationPanel, useNotifications } from "@/components/NotificationPanel";
import { NotificationPrefsModal } from "@/components/NotificationPrefsModal";
import { useGetDashboardTopMatches, useCreatePipelineItem, getGetDashboardTopMatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAiChat, type AiTenderCard } from "@/hooks/useAiChat";
import {
  IconLayoutDashboard,
  IconStarFilled,
  IconSearch,
  IconListDetails,
  IconChartAreaLine,
  IconBell,
  IconRobot,
  IconSun,
  IconMoon,
  IconMenu2,
  IconX,
  IconUser,
  IconLogout,
  IconChevronLeft,
  IconSend,
  IconBuilding,
  IconCrown,
  IconBolt,
  IconSparkles,
  IconCircleCheck,
  IconCalendar,
  IconMapPin,
  IconCurrencyLira,
  IconLock,
  IconSettings,
  IconZoomMoney,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useEntitlement } from "@/hooks/useEntitlement";
import { startCheckout, openBillingPortal } from "@/lib/billing";
import { ProLockBadge } from "@/components/PaywallOverlay";
import { toast } from "sonner";

const NAV_ITEMS = [
  { href: "/ihale-arama", label: "İhale Arama", icon: IconSearch },
  { href: "/dashboard", label: "Gösterge Paneli", icon: IconLayoutDashboard, pro: true },
  { href: "/firsatlarim", label: "Fırsatlarım", icon: IconStarFilled, pro: true },
  { href: "/pipeline", label: "Pipeline", icon: IconListDetails, pro: true },
  { href: "/raporlar", label: "Raporlar", icon: IconChartAreaLine, pro: true },
  { href: "/ayarlar", label: "Ayarlar", icon: IconSettings },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AppShellProps {
  children: React.ReactNode;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function AppShell({ children }: AppShellProps) {
  const [location, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isOpen: aiOpen, togglePanel, closePanel } = useAiPanelStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [topSearch, setTopSearch] = useState("");

  const { data: adminCheckData } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/marketing/admin-check`);
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminCheckData?.isAdmin ?? false;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const { data: notifData } = useNotifications();
  const { isPro } = useEntitlement();
  const qc = useQueryClient();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const { data: creditsData } = useQuery<{ credits: number }>({
    queryKey: ["/api/credits"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/credits`);
      if (!res.ok) return { credits: 0 };
      return res.json();
    },
    enabled: !isPro,
    staleTime: 30_000,
  });
  const searchCredits = creditsData?.credits ?? 0;

  // After returning from Stripe Checkout (`?checkout=success`), poll the
  // entitlement endpoint until the synced subscription flips the plan to Pro,
  // then refresh every query so locked content unlocks app-wide.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    params.delete("checkout");
    const clean = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState({}, "", clean);
    toast.success("Ödeme alındı, Pro üyeliğiniz aktifleştiriliyor…");

    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      tries++;
      try {
        const res = await fetch(`${API_BASE}/billing/entitlement?fresh=1`);
        const data = (await res.json()) as { plan: "free" | "pro" };
        qc.setQueryData(["/api/billing/entitlement"], data);
        if (data.plan === "pro") {
          qc.invalidateQueries();
          toast.success("Pro üyeliğiniz aktif! Tüm özellikler açıldı. 🎉");
          return;
        }
      } catch {
        // ignore and retry
      }
      if (tries < 10) {
        timer = setTimeout(poll, 2000);
      } else {
        qc.invalidateQueries();
        toast.info(
          "Planınız henüz güncellenmediyse lütfen sayfayı yenileyin ya da destek ekibiyle iletişime geçin.",
          { duration: 8000 },
        );
      }
    };
    poll();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = async () => {
    if (upgradeLoading) return;
    setUpgradeLoading(true);
    try {
      await startCheckout();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      toast.error(
        code === "no_price_configured"
          ? "Abonelik planı henüz hazır değil. Lütfen daha sonra tekrar deneyin."
          : "Ödeme başlatılamadı. Lütfen tekrar deneyin.",
      );
      setUpgradeLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openBillingPortal();
    } catch (err: any) {
      const code = err?.message ?? "";
      if (code === "portal_not_configured" || code.includes("portal")) {
        // Billing portal not set up in Stripe dashboard — send to payment link
        const paymentLink = "https://buy.stripe.com/14AfZh9p219Mddv4aG0Ny0b";
        window.open(paymentLink, "_blank", "noopener");
        toast.info("Abonelik yönetimi için Stripe sayfasına yönlendiriliyorsunuz.");
      } else {
        toast.error("Abonelik yönetimi açılamadı. Lütfen tekrar deneyin.");
      }
    }
  };

  const handleAiAssistant = () => {
    if (!isPro) {
      toast.info("AI Asistan Pro'ya özeldir. Hemen yükseltin.");
      navigate("/fiyatlandirma");
      return;
    }
    togglePanel();
  };

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDarkMode((d) => !d);
  };

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 p-4 border-b border-sidebar-border", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <span className="font-heading font-bold text-lg text-white tracking-tight select-none">İZ</span>
        ) : (
          <div className="bg-white rounded-lg px-2 py-1">
            <img src={`${basePath}/logo.svg`} alt="İhaleZeka" className="h-6 w-auto" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, pro }) => {
          const active = location === href || location.startsWith(href + "/");
          const locked = pro && !isPro;
          return (
            <Link key={href} href={href} onClick={() => setMobileSidebarOpen(false)}>
              <a className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                collapsed && "justify-center px-2",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}>
                <Icon className="h-4.5 w-4.5 shrink-0 h-[18px] w-[18px]" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && locked && <ProLockBadge />}
              </a>
            </Link>
          );
        })}

        {/* Admin-only: single entry point to the admin area */}
        {isAdmin && (
          <>
            <div className={cn("border-t border-sidebar-border my-2 mx-1", collapsed && "mx-0")} />
            <Link href="/admin" onClick={() => setMobileSidebarOpen(false)}>
              <a className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                collapsed && "justify-center px-2",
                (location === "/admin" || location.startsWith("/admin/"))
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}>
                <IconSettings className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="flex-1">⚙ Admin Paneli</span>}
              </a>
            </Link>
          </>
        )}
      </nav>

      {/* Plan Card */}
      {!collapsed && (isPro ? (
        <div className="mx-3 mb-3 rounded-xl bg-[#1B2C50] p-3 shadow-lg border border-[#2A3B62]/60">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <IconCircleCheck className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-white">Pro Üyelik Aktif</span>
          </div>
          <p className="text-[10px] text-white/70 mb-2.5 leading-relaxed">
            Tüm özellikler açık. Aboneliğinizi dilediğiniz zaman yönetebilirsiniz.
          </p>
          <button
            onClick={handleManageSubscription}
            className="w-full bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[11px] font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            Aboneliği Yönet
          </button>
        </div>
      ) : (
        <div className="mx-3 mb-3 rounded-xl bg-[#1B2C50] border border-[#2A3B62]/60 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <IconCrown className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-white">Pro'ya Yükseltin</span>
          </div>
          <p className="text-[10px] text-white/60 mb-2.5 leading-relaxed">
            Tüm araçların kilidini açın.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <IconBolt className="h-3 w-3 text-amber-400" />
            {upgradeLoading ? "Yönlendiriliyor…" : "Planı Yükselt"}
          </button>
        </div>
      ))}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={isPro ? handleManageSubscription : handleUpgrade}
            className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors"
            title={isPro ? "Aboneliği Yönet" : "Planı Yükselt"}
          >
            <IconCrown className="h-4 w-4 text-amber-400" />
          </button>
        </div>
      )}

      {/* User */}
      <div className={cn("p-3 border-t border-sidebar-border", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Link href="/ayarlar" onClick={() => setMobileSidebarOpen(false)}>
            <a className={cn(
              "flex items-center gap-2.5 min-w-0 cursor-pointer rounded-lg transition-colors hover:bg-sidebar-accent",
              collapsed ? "p-1" : "flex-1 p-1 -m-1"
            )}>
              <div className="h-8 w-8 rounded-full bg-[#2D5BFF] flex items-center justify-center shrink-0 text-xs font-semibold text-white shadow-sm overflow-hidden">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  user?.firstName?.[0] ?? "M"
                )}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.firstName ?? "Mehmet Yılmaz"}</p>
                    <Badge className={cn(
                      "text-[9px] px-1 py-0 h-3.5",
                      isPro
                        ? "bg-[#2D5BFF]/30 text-white/80 border-[#2D5BFF]/30"
                        : "bg-sidebar-foreground/10 text-sidebar-foreground/60 border-sidebar-foreground/20"
                    )}>{isPro ? "Pro" : "Ücretsiz"}</Badge>
                  </div>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.emailAddresses?.[0]?.emailAddress ?? "mehmet@firma.com"}</p>
                </div>
              )}
            </a>
          </Link>
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
              onClick={() => signOut()}>
              <IconLogout className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 transition-all duration-200",
        sidebarCollapsed ? "w-14" : "w-60"
      )}>
        <SidebarContent collapsed={sidebarCollapsed} />
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-[52px] h-6 w-6 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors z-10"
          style={{ left: sidebarCollapsed ? 50 : 228 }}
        >
          <IconChevronLeft className={cn("h-3 w-3 transition-transform", sidebarCollapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-60 p-0 bg-sidebar border-sidebar-border">
          <SidebarContent collapsed={false} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 shrink-0">
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileSidebarOpen(true)}>
            <IconMenu2 className="h-4 w-4" />
          </Button>

          <form
            className="relative flex-1 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              const q = topSearch.trim();
              navigate(q ? `/ihale-arama?q=${encodeURIComponent(q)}` : "/ihale-arama");
            }}
          >
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              placeholder="İhale veya idare ara…"
              value={topSearch}
              onChange={(e) => setTopSearch(e.target.value)}
            />
          </form>

          <div className="flex items-center gap-1.5 ml-auto">
            {!isPro && creditsData !== undefined && (
              searchCredits > 0 ? (
                <button
                  onClick={handleUpgrade}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                  title="Ücretsiz AI analiz hakkı"
                >
                  <IconZoomMoney className="h-3.5 w-3.5" />
                  {searchCredits} arama hakkı
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                  title="Kredi bitti — Pro'ya geç"
                >
                  <IconZoomMoney className="h-3.5 w-3.5" />
                  Kredi bitti
                </button>
              )
            )}

            <Button
              variant="default"
              size="sm"
              className="gap-2 h-8"
              onClick={handleAiAssistant}
            >
              <IconRobot className="h-3.5 w-3.5" />
              AI Asistan
              {!isPro && <IconLock className="h-3 w-3 text-yellow-300" />}
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleDark}>
              {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            </Button>

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={() => setNotifPanelOpen((o) => !o)}
              >
                <IconBell className="h-4 w-4" />
                {notifData.unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-white leading-none">
                    {notifData.unreadCount > 9 ? "9+" : notifData.unreadCount}
                  </span>
                )}
              </Button>
              <NotificationPanel
                open={notifPanelOpen}
                onClose={() => setNotifPanelOpen(false)}
                onPrefsClick={() => { setNotifPanelOpen(false); setPrefsModalOpen(true); }}
              />
            </div>

            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-white ml-1 cursor-pointer">
              {user?.firstName?.[0] ?? <IconUser className="h-3.5 w-3.5" />}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* AI Panel */}
      <AiPanel open={aiOpen} onClose={closePanel} />

      {/* Notification Preferences Modal */}
      <NotificationPrefsModal open={prefsModalOpen} onClose={() => setPrefsModalOpen(false)} />
    </div>
  );
}

// ── Agent result card (rendered inside chat) ──────────────────────
function AiResultCard({
  card,
  added,
  pending,
  onAdd,
  onNavigate,
}: {
  card: AiTenderCard;
  added: boolean;
  pending: boolean;
  onAdd: () => void;
  onNavigate: () => void;
}) {
  const deadline = card.deadline ? new Date(card.deadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400_000) : null;
  return (
    <div className="p-3 bg-background rounded-lg border border-border hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-2.5 mb-2">
        <AgencyLogo name={card.agency} logoUrl={card.agencyLogoUrl ?? undefined} className="h-7 w-7 rounded shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold line-clamp-2 text-foreground">{card.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{card.agency}</p>
        </div>
        {typeof card.fitScore === "number" && (
          <span className="ml-auto shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
            %{card.fitScore}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground mb-2">
        {card.il && (
          <span className="flex items-center gap-0.5"><IconMapPin className="h-3 w-3" />{card.il}</span>
        )}
        {deadline && (
          <span className={cn("flex items-center gap-0.5", daysLeft != null && daysLeft <= 7 && daysLeft >= 0 && "text-amber-600 font-medium")}>
            <IconCalendar className="h-3 w-3" />
            {daysLeft != null && daysLeft > 0 ? `${daysLeft} gün` : daysLeft === 0 ? "Bugün son gün" : "Süresi geçti"}
          </span>
        )}
        {card.estimatedValue != null && (
          <span className="flex items-center gap-0.5 font-semibold text-foreground">
            <IconCurrencyLira className="h-3 w-3" />{card.estimatedValue.toLocaleString("tr-TR")}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Link href={`/ihale/${card.id}`} onClick={onNavigate}>
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2">Detay</Button>
        </Link>
        <Button
          size="sm"
          className="h-6 text-[11px] px-2"
          disabled={added || pending}
          onClick={onAdd}
        >
          {added ? "Eklendi ✓" : "Pipeline'a Ekle"}
        </Button>
      </div>
    </div>
  );
}

// ── AI Sliding Panel ──────────────────────────────────────────────
function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: topMatches } = useGetDashboardTopMatches({
    query: { queryKey: getGetDashboardTopMatchesQueryKey(), enabled: open },
  });
  const [input, setInput] = useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const createPipeline = useCreatePipelineItem();
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const addToPipeline = (tenderId: number) => {
    if (addedIds.has(tenderId) || createPipeline.isPending) return;
    createPipeline.mutate(
      { data: { tenderId, stage: "discovery" } as any },
      {
        onSuccess: () => {
          setAddedIds((prev) => new Set(prev).add(tenderId));
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pipeline-summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/win-predictions"] });
        },
      }
    );
  };

  const aiContext = React.useMemo(() => ({
    mode: "general" as const,
    topMatches: (Array.isArray(topMatches) ? topMatches : []).slice(0, 6).map((m: any) => ({
      title: m.tender.title,
      agency: m.tender.agencyName,
      fitScore: m.fitScore,
      deadline: m.tender.deadline ?? null,
    })),
  }), [topMatches]);

  const onAgentAction = React.useCallback(
    (action: { type: string; ok?: boolean }) => {
      if (action.type === "pipeline_added" && action.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pipeline-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/win-predictions"] });
      }
    },
    [queryClient]
  );

  const { messages, isStreaming, elapsedMs, streamDone, sendMessage, cancelStream } = useAiChat(
    "Merhaba! Size en uygun ihaleleri bulabilir, teklif stratejisi önerebilir veya sektör analizleri sunabilirim.",
    aiContext,
    undefined,
    onAgentAction
  );

  const matches = Array.isArray(topMatches) ? topMatches : [];

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function fitChip(score: number) {
    if (score >= 70) return "bg-emerald-100 text-emerald-700";
    if (score >= 40) return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  }

  function statusLabel(status: string) {
    switch (status) {
      case "pipeline": return { label: "PİPELINE'DA", cls: "bg-primary/10 text-primary" };
      case "watching": return { label: "İZLENİYOR", cls: "bg-amber-100 text-amber-700" };
      default: return { label: "YENİ", cls: "bg-emerald-100 text-emerald-700" };
    }
  }

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />}
      {/* Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-full z-50 w-[380px] max-w-[100vw] bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <IconRobot className="h-5 w-5 text-primary" />
            <span className="font-heading font-bold text-base">İhaleZeka'ya Sor</span>
            {elapsedMs !== null && (
              <span className={cn(
                "text-[11px] text-muted-foreground transition-opacity duration-500",
                streamDone ? "opacity-60" : "opacity-100"
              )}>
                {isStreaming ? `yanıtlanıyor… ${(elapsedMs / 1000).toFixed(1)}s` : `${(elapsedMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <IconX className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top Matches */}
          {matches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Önerilen Fırsatlar</p>
              <div className="space-y-2">
                {matches.slice(0, 4).map((m: any) => {
                  const s = statusLabel(m.status);
                  return (
                    <div key={m.id} className="p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/30 transition-colors">
                      <div className="flex items-start gap-2.5 mb-2">
                        <AgencyLogo name={m.tender.agencyName} logoUrl={m.tender.agencyLogoUrl} className="h-7 w-7 rounded shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium line-clamp-2">{m.tender.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{m.tender.agencyName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold", fitChip(m.fitScore))}>{m.fitScore}</span>
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", s.cls)}>{s.label}</span>
                        {(m.tender.cpvCodes ?? []).slice(0, 1).map((c: string) => (
                          <span key={c} className="text-[11px] px-2 py-0.5 bg-accent text-accent-foreground rounded-full">{c}</span>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Link href={`/ihale/${m.tender.id}`} onClick={onClose}>
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2">Detay</Button>
                        </Link>
                        <Button
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          disabled={addedIds.has(m.tender.id) || createPipeline.isPending}
                          onClick={() => addToPipeline(m.tender.id)}
                        >
                          {addedIds.has(m.tender.id) ? "Eklendi ✓" : "Pipeline'a Ekle"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs",
                  msg.role === "user" ? "bg-primary text-white" : "bg-accent text-accent-foreground")}>
                  {msg.role === "user" ? <IconUser className="h-3.5 w-3.5" /> : <IconRobot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn("min-w-0 flex flex-col gap-2", msg.role === "user" ? "items-end max-w-[85%]" : "max-w-[88%]")}>
                  {(msg.content || msg.streaming || msg.toolStatus) && (
                    <div className={cn("px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user" ? "bg-primary text-white rounded-tr-none" : "bg-muted text-foreground rounded-tl-none")}>
                      {msg.toolStatus && !msg.content && (
                        <span className="italic text-muted-foreground">{msg.toolStatus}</span>
                      )}
                      {msg.content}
                      {msg.streaming && (
                        <span className="inline-flex gap-0.5 ml-1 align-middle">
                          <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      )}
                    </div>
                  )}
                  {msg.notice && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-2.5 py-1.5">
                      <IconCircleCheck className="h-3.5 w-3.5 shrink-0" />
                      {msg.notice}
                    </div>
                  )}
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="space-y-2 w-full">
                      {msg.cards.map((c) => (
                        <AiResultCard
                          key={c.id}
                          card={c}
                          added={addedIds.has(c.id)}
                          pending={createPipeline.isPending}
                          onAdd={() => addToPipeline(c.id)}
                          onNavigate={onClose}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat input */}
        <div className="p-4 border-t border-border flex gap-2">
          <Input
            placeholder="Bir şey sorun…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isStreaming && handleSend()}
            className="text-sm"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button size="icon" variant="outline" onClick={cancelStream} title="Durdur">
              <IconX className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
              <IconSend className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

