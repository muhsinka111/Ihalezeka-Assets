import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useAiPanelStore } from "@/store/aiPanelStore";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AgencyLogo } from "@/components/AgencyLogo";
import { useGetDashboardTopMatches } from "@workspace/api-client-react";
import {
  IconLayoutDashboard,
  IconStarFilled,
  IconSearch,
  IconListDetails,
  IconTruckDelivery,
  IconChartBar,
  IconCash,
  IconFileText,
  IconChartAreaLine,
  IconPlug,
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
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: IconLayoutDashboard },
  { href: "/firsatlarim", label: "Fırsatlarım", icon: IconStarFilled },
  { href: "/ihale-arama", label: "İhale Arama", icon: IconSearch },
  { href: "/boru-hatti", label: "Boru Hattı", icon: IconListDetails },
  { href: "/teklif-olusturucu", label: "Teklif Oluşturucu", icon: IconFileText },
  { href: "/basvuru-sihirbazi", label: "Başvuru Sihirbazı", icon: IconTruckDelivery },
  { href: "/rakip-analizi", label: "Rakip Analizi", icon: IconChartBar },
  { href: "/para-akisi", label: "Para Akışı", icon: IconCash },
  { href: "/belgelerim", label: "Belgelerim", icon: IconFileText },
  { href: "/raporlar", label: "Raporlar", icon: IconChartAreaLine },
  { href: "/entegrasyonlar", label: "Entegrasyonlar", icon: IconPlug },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isOpen: aiOpen, togglePanel, closePanel } = useAiPanelStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDarkMode((d) => !d);
  };

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 p-4 border-b border-sidebar-border", collapsed && "justify-center px-2")}>
        <img src={`${basePath}/logo.svg`} alt="İhaleZeka" className="h-8 w-8 rounded-full shrink-0" />
        {!collapsed && <span className="font-heading font-bold text-lg text-white tracking-tight">İhaleZeka</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
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
                {!collapsed && label}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn("p-3 border-t border-sidebar-border", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 text-xs font-semibold text-white">
            {user?.firstName?.[0] ?? <IconUser className="h-4 w-4" />}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.firstName ?? "Kullanıcı"}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.emailAddresses?.[0]?.emailAddress ?? ""}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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

          <div className="relative flex-1 max-w-md">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              placeholder="İhale veya idare ara…"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="default"
              size="sm"
              className="gap-2 h-8"
              onClick={togglePanel}
            >
              <IconRobot className="h-3.5 w-3.5" />
              AI Asistan
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-white/20 text-white border-0">BETA</Badge>
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleDark}>
              {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <IconBell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </Button>

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
    </div>
  );
}

// ── AI Sliding Panel ──────────────────────────────────────────────
function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: topMatches } = useGetDashboardTopMatches();
  const [message, setMessage] = useState("");

  const matches = topMatches ?? [];

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

  type ChatMessage = { role: "assistant" | "user"; text: string };
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "Merhaba! Size en uygun ihaleleri bulabilir, teklif stratejisi önerebilir veya sektör analizleri sunabilirim." }
  ]);

  const send = () => {
    if (!message.trim()) return;
    setMessages(m => [...m, { role: "user", text: message }]);
    setTimeout(() => {
      setMessages(m => [...m, { role: "assistant", text: "Anladım. Bu konuyu analiz ediyorum — sonuçlarınızı birkaç saniye içinde göreceksiniz. Daha spesifik bir ihale veya kategori belirtmek ister misiniz?" }]);
    }, 900);
    setMessage("");
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
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
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
                        <Button size="sm" className="h-6 text-[11px] px-2">Pipeline'a Ekle</Button>
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
                <div className={cn("max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed",
                  msg.role === "user" ? "bg-primary text-white rounded-tr-none" : "bg-muted text-foreground rounded-tl-none")}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat input */}
        <div className="p-4 border-t border-border flex gap-2">
          <Input
            placeholder="Bir şey sorun…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="text-sm"
          />
          <Button size="icon" onClick={send} disabled={!message.trim()}>
            <IconSend className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

