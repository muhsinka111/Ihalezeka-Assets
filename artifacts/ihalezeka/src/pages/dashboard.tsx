import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { NewMatchesBanner } from "@/components/NewMatchesBanner";
import { AgencyLogo } from "@/components/AgencyLogo";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/useAiChat";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardStats,
  useGetDashboardTopMatches,
  useGetDashboardMoneyFlowSparkline,
  useGetDashboardWinPredictions,
  useListPipelineItems,
  useListTenders,
  getGetDashboardStatsQueryKey,
  getGetDashboardWinPredictionsQueryKey,
  getGetDashboardPipelineSummaryQueryKey,
  getListPipelineItemsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import {
  IconTrendingUp, IconTrendingDown, IconBriefcase, IconTrophy,
  IconClock, IconTarget, IconRobot, IconSearch, IconDownload,
  IconChevronRight, IconBuilding, IconCalendar,
  IconCircleCheck, IconBolt, IconFileText, IconFilter,
  IconStarFilled, IconFlame,
} from "@tabler/icons-react";

// ── Helpers ────────────────────────────────────────────────────────
function fmtTL(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `₺${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return `₺${n.toLocaleString("tr-TR")}`;
}

function daysUntil(deadline: Date | string | null | undefined): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function fmtDate(deadline: Date | string | null | undefined): string {
  if (!deadline) return "—";
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

function deadlineBadgeCls(days: number | null): string {
  if (days == null) return "bg-muted text-muted-foreground";
  if (days <= 9) return "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  if (days <= 15) return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
}

const STAGE_LABELS: Record<string, string> = {
  discovery: "Fırsat Keşfi",
  preparation: "Teklif Hazırlığı",
  applied: "Başvuruldu",
  evaluation: "Değerlendirme",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};
const KANBAN_STAGES = ["discovery", "preparation", "applied", "evaluation"] as const;

const PIE_COLORS = ["#2D5BFF", "#6E8BFF", "#6E8BFF", "#EAEFFF", "#EAEFFF"];

// ── Dashboard Component ────────────────────────────────────────────
export default function DashboardPage() {
  const [, navigate] = useLocation();

  const { data: stats } = useGetDashboardStats();
  const { data: topMatches } = useGetDashboardTopMatches();
  const { data: moneyFlow } = useGetDashboardMoneyFlowSparkline();
  const { data: winPredictions } = useGetDashboardWinPredictions();
  const { data: pipelineItems } = useListPipelineItems();
  const { data: tendersData } = useListTenders({ limit: 100 });

  // ── KPI strip from real stats ──
  const kpiCards = useMemo(() => {
    const s = stats;
    return [
      { label: "Eşleşen Fırsatlar", value: s ? String(s.activeMatches) : "—", icon: IconBriefcase, trend: "up" as const },
      { label: "Takipteki İhaleler", value: s ? String(s.pipelineCount) : "—", icon: IconBriefcase, trend: "up" as const },
      { label: "Pipeline Değeri", value: s ? fmtTL(s.totalValue) : "—", icon: IconTrophy, trend: "up" as const },
      { label: "Kazanma Oranı", value: s ? `%${s.winRate}` : "—", icon: IconTarget, trend: "up" as const },
      { label: "Bugün Eklenen", value: s ? String(s.newTendersToday) : "—", icon: IconFlame, trend: "up" as const },
      { label: "Ort. Uyum Skoru", value: s ? `%${s.avgFitScore}` : "—", icon: IconStarFilled, trend: "up" as const },
    ];
  }, [stats]);

  // ── Money flow chart data ──
  const cashFlow = moneyFlow ?? [];
  const totalVolume = useMemo(
    () => cashFlow.reduce((acc, m) => acc + (m.amount ?? 0), 0),
    [cashFlow]
  );

  // ── Sector pie (by tender type) ──
  const sectorPie = useMemo(() => {
    const items = tendersData?.items ?? [];
    if (items.length === 0) return [];
    const byType = new Map<string, number>();
    for (const t of items) {
      const key = t.type || "Diğer";
      byType.set(key, (byType.get(key) ?? 0) + 1);
    }
    const sorted = [...byType.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const total = items.length;
    return top.map(([name, count], i) => ({
      name,
      value: Math.round((count / total) * 100),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [tendersData]);

  // ── Sector map (by province) ──
  const sectorMap = useMemo(() => {
    const items = tendersData?.items ?? [];
    if (items.length === 0) return [];
    const byIl = new Map<string, number>();
    for (const t of items) {
      const key = t.il || "Bilinmiyor";
      byIl.set(key, (byIl.get(key) ?? 0) + 1);
    }
    const sorted = [...byIl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([region, count]) => ({
      region,
      count,
      pct: Math.round((count / max) * 100),
    }));
  }, [tendersData]);

  // ── Kanban from pipeline items ──
  const kanbanCols = useMemo(() => {
    const items = pipelineItems ?? [];
    return KANBAN_STAGES.map((stage) => {
      const cards = items.filter((i) => i.stage === stage);
      return {
        stage,
        title: STAGE_LABELS[stage],
        count: cards.length,
        cards: cards.slice(0, 3),
      };
    });
  }, [pipelineItems]);

  // ── Upcoming deadlines from top matches ──
  const deadlines = useMemo(() => {
    const items = (topMatches ?? [])
      .map((m) => ({ tender: m.tender, days: daysUntil(m.tender.deadline) }))
      .filter((d) => d.days != null && d.days >= 0)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
      .slice(0, 3);
    return items;
  }, [topMatches]);

  // ── Mini AI chat (real) ──
  const queryClient = useQueryClient();
  const [aiMsg, setAiMsg] = useState("");
  const { messages, isStreaming, sendMessage } = useAiChat(
    "Size nasıl yardımcı olabilirim? Doğal dilde yazın (örn. \"yazılım ihalesi ara\").",
    undefined,
    undefined,
    (action) => {
      if (action.type === "pipeline_added" && action.ok) {
        queryClient.invalidateQueries({ queryKey: getListPipelineItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardPipelineSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardWinPredictionsQueryKey() });
      }
    }
  );
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  const sendAi = () => {
    if (!aiMsg.trim() || isStreaming) return;
    const text = aiMsg;
    setAiMsg("");
    sendMessage(text);
  };

  return (
    <div className="space-y-5 pb-8 min-w-0">

      {/* ── New Matches Banner ─────────────────────────────────── */}
      <NewMatchesBanner />

      {/* ── Welcome Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-foreground tracking-tight">
            Hoş geldiniz, Mehmet 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bugün sizin için derlediğimiz özet bilgiler</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => navigate("/firsatlarim")}>
            <IconFlame className="h-4 w-4 text-orange-500" />
            Hızlı Eylemler
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => navigate("/raporlar")}>
            <IconDownload className="h-4 w-4" />
            Rapor Dışa Aktar
          </Button>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                  <Icon className="h-[17px] w-[17px] text-muted-foreground" />
                </div>
                {k.trend === "up"
                  ? <IconTrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  : <IconTrendingDown className="h-3.5 w-3.5 text-rose-500" />}
              </div>
              <div className="text-[22px] font-bold font-heading text-foreground leading-none">{k.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1 font-medium leading-tight">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Main 3-column Layout ───────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Left — En Uygun İhaleler */}
        <div className="col-span-12 lg:col-span-5 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <h2 className="font-heading font-semibold text-sm text-foreground">Sizin İçin En Uygun İhaleler</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <IconFilter className="h-3.5 w-3.5" />
              </Button>
              <Link href="/firsatlarim">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                  Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="divide-y divide-border/50 flex-1">
            {(topMatches ?? []).slice(0, 5).map((m) => {
              const t = m.tender;
              const days = daysUntil(t.deadline);
              return (
                <Link key={m.id} href={`/ihale/${t.id}`}>
                  <div className="px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl flex flex-col items-center justify-center shrink-0 border border-border bg-muted/50 text-xs font-bold">
                        <span className="text-[9px] font-medium text-muted-foreground">uyum</span>
                        <span className="text-sm font-bold leading-none text-foreground">%{m.fitScore}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{t.title}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] shrink-0 border-primary/40 text-primary bg-primary/5">
                            Eşleşme
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{t.agencyName}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-foreground">{fmtTL(t.estimatedValue)}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <IconCalendar className="h-3 w-3" /> Son: {fmtDate(t.deadline)}
                          </span>
                          {days != null && (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold", deadlineBadgeCls(days))}>
                              {days > 0 ? `${days} gün kaldı` : days === 0 ? "Bugün son gün!" : "Süresi geçti"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {(topMatches ?? []).length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">Henüz eşleşme yok.</div>
            )}
          </div>
        </div>

        {/* Centre — Para Akışı + AI Mini */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

          {/* Para Akışı */}
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div>
                <h2 className="font-heading font-semibold text-sm text-foreground">Para Akışı Analizi</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fmtTL(totalVolume)} · Son 7 Ay Toplam Hacim</p>
              </div>
              <Link href="/raporlar">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                  Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="px-4 pt-3 pb-1">
              <div className="flex gap-4 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#2D5BFF" }} />
                  <span className="text-[11px] text-muted-foreground">İhale Hacmi</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={cashFlow} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gHacim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D5BFF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2D5BFF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTL(v).replace("₺", "")} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    formatter={(v: number) => [fmtTL(v), "Hacim"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#2D5BFF" strokeWidth={2} fill="url(#gHacim)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Mini donut + sector breakdown */}
            {sectorPie.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 border-t border-border/50">
                <div className="shrink-0" style={{ width: 72, height: 72 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sectorPie} cx="50%" cy="50%" innerRadius={20} outerRadius={33} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        {sectorPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  {sectorPie.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] text-muted-foreground flex-1 truncate capitalize">{s.name}</span>
                      <span className="text-[10px] font-bold text-foreground">%{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Asistanım mini */}
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden flex-1">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                  <IconRobot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="font-heading font-semibold text-sm text-foreground">AI Asistanınız</span>
              </div>
              <Link href="/firsatlarim">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                  Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <IconRobot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="bg-muted/50 border border-border/50 rounded-xl rounded-tl-none px-3 py-2 text-xs text-foreground leading-relaxed">
                  {lastAssistant?.content || "Analiz ediyorum…"}
                  {isStreaming && (
                    <span className="inline-flex gap-0.5 ml-1 align-middle">
                      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {["Yazılım ihalesi ara", "Yaklaşan son tarihler", "En uygun fırsatlar"].map((q) => (
                  <button key={q} onClick={() => { setAiMsg(""); sendMessage(q); }}
                    disabled={isStreaming}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium disabled:opacity-50">
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Bir şey sorun…"
                  value={aiMsg}
                  onChange={(e) => setAiMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendAi()}
                />
                <button onClick={sendAi} disabled={isStreaming}
                  className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity shrink-0 disabled:opacity-50">
                  <IconChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Quick actions + Deadlines + Premium */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">

          {/* Hızlı İşlemler */}
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <h2 className="font-heading font-semibold text-sm text-foreground">Hızlı İşlemler</h2>
            </div>
            <div className="p-3 space-y-2">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-muted/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="İhale Ara"
                  onKeyDown={(e) => { if (e.key === "Enter") navigate("/firsatlarim"); }}
                />
              </div>
              {[
                { icon: IconBolt, label: "Firma Profilini Tamamla", badge: "YENİ", badgeCls: "bg-emerald-500 text-white", to: "/ayarlar?tab=sirket" },
                { icon: IconFileText, label: "Teklif Oluştur", badge: null, badgeCls: "", to: "/boru-hatti" },
                { icon: IconDownload, label: "Belge Yükle", badge: null, badgeCls: "", to: "/ayarlar?tab=belgeler" },
              ].map((action) => (
                <button key={action.label} onClick={() => navigate(action.to)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all group">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-muted">
                      <action.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {action.badge && (
                      <Badge className={cn("text-[9px] px-1 py-0 h-3.5 border-0", action.badgeCls)}>{action.badge}</Badge>
                    )}
                    <IconChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Yaklaşan Son Teslim */}
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h2 className="font-heading font-semibold text-sm text-foreground">Yaklaşan Son Teslim</h2>
              <Link href="/firsatlarim">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                  Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {deadlines.map((d) => (
                <Link key={d.tender.id} href={`/ihale/${d.tender.id}`}>
                  <div className="flex items-start gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className={cn("h-9 w-9 rounded-lg flex flex-col items-center justify-center shrink-0", deadlineBadgeCls(d.days))}>
                      <span className="text-xs font-bold leading-none">{d.days}</span>
                      <span className="text-[9px] font-medium opacity-70">gün</span>
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-1">{d.tender.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.tender.agencyName}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {deadlines.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Yaklaşan son tarih yok.</p>
              )}
            </div>
          </div>

          {/* Benim Adıma Başvur premium */}
          <div className="rounded-xl bg-[#1B2C50] shadow-lg overflow-hidden p-4 text-white relative">
            <div className="absolute top-3 right-3">
              <Badge className="text-[9px] px-1.5 py-0 h-[17px] bg-white/20 border-white/30 text-white">YENİ ÖZELLİK</Badge>
            </div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <IconBolt className="h-5 w-5 text-yellow-300" />
              </div>
              <div>
                <p className="text-sm font-bold leading-none">Benim Adıma Başvur</p>
                <p className="text-[11px] text-white/60 mt-0.5">Premium özellik</p>
              </div>
            </div>
            <p className="text-[11px] text-white/80 mb-2.5 leading-relaxed">İhale süreçlerini otomatik yönetin:</p>
            <ul className="space-y-1.5 mb-4">
              {["Başvuruyu otomatik doldurur", "Belgeleri hazırlar ve kontrol eder", "Son tarihleri takip eder"].map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-[11px] text-white/90">
                  <IconCircleCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate("/ayarlar?tab=sirket")}
              className="w-full bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold text-xs py-2 rounded-lg transition-colors">
              Hemen Dene
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Başvuru Süreçleri — Kanban */}
        <div className="col-span-12 xl:col-span-6 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h2 className="font-heading font-semibold text-sm text-foreground">Başvuru Süreçleri</h2>
            <Link href="/boru-hatti">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {kanbanCols.map((col) => (
                <div key={col.stage} className="w-[185px] shrink-0">
                  <div className="flex items-center justify-between mb-2.5 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/50">
                    <span className="text-[11px] font-bold text-foreground">{col.title}</span>
                    <span className="text-[11px] font-bold ml-2 px-1.5 py-0.5 rounded-full bg-background border border-border/50 text-muted-foreground">{col.count}</span>
                  </div>
                  <div className="space-y-2">
                    {col.cards.map((card) => (
                      <Link key={card.id} href={`/ihale/${card.tender.id}`}>
                        <div className="p-2.5 rounded-lg border border-border/50 bg-background hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                          <p className="text-[11px] font-semibold text-foreground line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{card.tender.title}</p>
                          <div className="flex items-center gap-1.5">
                            <IconBuilding className="h-3 w-3 text-muted-foreground shrink-0" />
                            <p className="text-[10px] text-muted-foreground truncate">{card.tender.agencyName}</p>
                          </div>
                          <p className="text-[11px] font-bold text-[#2D5BFF] dark:text-[#6E8BFF] mt-1">{fmtTL(card.tender.estimatedValue)}</p>
                        </div>
                      </Link>
                    ))}
                    {col.cards.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-3">Boş</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Kazanma Tahmini */}
        <div className="col-span-12 xl:col-span-3 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-semibold text-sm text-foreground">Kazanma Tahmini</h2>
              <Badge className="text-[9px] px-1.5 py-0 h-[17px] bg-primary text-primary-foreground border-0">AI</Badge>
            </div>
            <Link href="/boru-hatti">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="p-4 space-y-3.5">
            {(winPredictions ?? []).map((item) => {
              const label = item.probability >= 70 ? "Yüksek" : item.probability >= 50 ? "Orta" : "Düşük";
              return (
                <Link key={item.tenderId} href={`/ihale/${item.tenderId}`}>
                  <div className="cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-medium text-foreground line-clamp-1 flex-1 mr-2">{item.tenderTitle}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-foreground">%{item.probability}</span>
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${item.probability}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
            {(winPredictions ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Pipeline'a ihale ekleyince tahminler burada görünür.</p>
            )}
          </div>
        </div>

        {/* Sektörel Fırsat Haritası */}
        <div className="col-span-12 xl:col-span-3 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h2 className="font-heading font-semibold text-sm text-foreground">Sektörel Fırsat Haritası</h2>
            <Link href="/firsatlarim">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="p-4 space-y-2.5">
            {sectorMap.map((r) => (
              <div key={r.region} className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    backgroundColor: `rgba(99,102,241,${0.12 + (r.pct / 100) * 0.65})`,
                    color: r.pct > 50 ? "#1E45D6" : "#2D5BFF",
                  }}>
                  {r.count}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-foreground">{r.region}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-[#2D5BFF] transition-all"
                      style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {sectorMap.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Veri yok.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
