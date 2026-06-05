import { useState } from "react";
import { Link } from "wouter";
import { NewMatchesBanner } from "@/components/NewMatchesBanner";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  IconTrendingUp, IconTrendingDown, IconBriefcase, IconTrophy,
  IconClock, IconTarget, IconRobot, IconSearch, IconDownload,
  IconChevronRight, IconBuilding, IconCalendar,
  IconCircleCheck, IconBolt, IconChartBar,
  IconCash, IconChartAreaLine, IconFileText, IconFilter,
  IconStarFilled, IconFlame,
} from "@tabler/icons-react";

// ── Demo Data ──────────────────────────────────────────────────────

const KPI_CARDS = [
  { label: "Eşleşen Fırsatlar", value: "128", change: "+18 bu hafta", trend: "up", icon: IconBriefcase },
  { label: "Başvuruda Bulunduğum", value: "24", change: "+12 bu hafta", trend: "up", icon: IconFileText },
  { label: "Kazanılan Sözleşmeler", value: "₺28.7M", change: "+%37 bu ay", trend: "up", icon: IconTrophy },
  { label: "Kazanma Oranı", value: "%37", change: "+%8 bu ay", trend: "up", icon: IconTarget },
  { label: "Takipteki İhaleler", value: "56", change: "+%8 bu hafta", trend: "up", icon: IconChartAreaLine },
  { label: "Yaklaşan Son Teslim", value: "7", change: "3'ü bugün sona eriyor", trend: "down", icon: IconClock },
  { label: "Ort. Uyum Skoru", value: "%85", change: "+%3 bu ay", trend: "up", icon: IconStarFilled },
];

const TOP_TENDERS = [
  { id: 1, match: 95, title: "Okul Binası Yapım İşi", no: "2024/567890", agency: "İstanbul İl Milli Eğitim Müdürlüğü", budget: "₺45.000.000", deadline: "20 Mayıs 2024", daysLeft: 8, category: "Yapım" },
  { id: 2, match: 80, title: "Tıbbi Cihaz Alımı", no: "2024/567891", agency: "Ankara Şehir Hastanesi", budget: "₺12.500.000", deadline: "25 Mayıs 2024", daysLeft: 14, category: "Mal Alımı" },
  { id: 3, match: 75, title: "Yol Yapım ve Onarım İşi", no: "2024/567892", agency: "Karayolları 1. Bölge Müd.", budget: "₺28.750.000", deadline: "28 Mayıs 2024", daysLeft: 17, category: "Yapım" },
  { id: 4, match: 60, title: "E-posta Tasarıcı Yazılım", no: "2024/567893", agency: "Karayolları 1. Bölge Müd.", budget: "₺3.200.000", deadline: "2 Haziran 2024", daysLeft: 22, category: "Hizmet" },
  { id: 5, match: 70, title: "Yazılım Lisans Alımı", no: "2024/567894", agency: "TÜBİTAK BİLGEM", budget: "₺3.200.000", deadline: "2 Haziran 2024", daysLeft: 22, category: "Mal Alımı" },
];

const CASH_FLOW_DATA = [
  { ay: "Oca", gelir: 120, gider: 85 },
  { ay: "Şub", gelir: 145, gider: 92 },
  { ay: "Mar", gelir: 168, gider: 110 },
  { ay: "Nis", gelir: 142, gider: 95 },
  { ay: "May", gelir: 195, gider: 125 },
  { ay: "Haz", gelir: 220, gider: 140 },
  { ay: "Tem", gelir: 185, gider: 118 },
];

const SECTOR_PIE = [
  { name: "Yapım İşleri", value: 40, color: "#6366f1" },
  { name: "Mal Alımı", value: 25, color: "#8b5cf6" },
  { name: "Hizmet Alımı", value: 20, color: "#a78bfa" },
  { name: "Danışmanlık", value: 10, color: "#c4b5fd" },
  { name: "Diğer", value: 5, color: "#e0e7ff" },
];

const KANBAN_COLS = [
  {
    title: "Fırsat Keşfi", count: 12,
    cards: [
      { title: "Lojistik Hizmet Alımı", budget: "₺2.500.000", org: "İstanbul Üniversitesi" },
      { title: "Güvenlik Hizmet Alımı", budget: "₺1.300.000", org: "Ankara Adliyesi" },
    ],
  },
  {
    title: "Teklif Hazırlığı", count: 8,
    cards: [
      { title: "Yazılım Geliştirme İşi", budget: "₺5.750.000", org: "TÜBİTAK BİLGEM" },
      { title: "Laboratuvar Cihazları Alımı", budget: "₺3.400.000", org: "Ege Üniversitesi" },
    ],
  },
  {
    title: "Okul Onarım", count: 4,
    cards: [
      { title: "Okul Onarım İşi", budget: "₺3.800.000", org: "İstanbul İl Milli Eğitim" },
      { title: "Malzeme Alımı", budget: "₺350.000", org: "MEB İkmal D.şk." },
    ],
  },
  {
    title: "Değerlendirme", count: 3,
    cards: [
      { title: "Hastane Yapım İşi", budget: "₺75.000.000", org: "Sağlık Bakanlığı" },
      { title: "Akıllı Tahta Alımı", budget: "₺1.150.000", org: "MEB Eğitim Bakanlığı" },
    ],
  },
];

const WIN_PREDICTION = [
  { name: "Okul Binası Yapım İşi", pct: 78, label: "Yüksek" },
  { name: "Tıbbi Cihaz Alımı", pct: 65, label: "Orta" },
  { name: "Yol Yapım ve Onarım İşi", pct: 52, label: "Orta" },
  { name: "Rakip Analizi Yazılım", pct: 40, label: "Düşük" },
  { name: "Yazılım Lisans Alımı", pct: 40, label: "Düşük" },
];

const SECTOR_MAP = [
  { region: "Marmara", city: "İstanbul, Bursa", count: 42, pct: 100 },
  { region: "İç Anadolu", city: "Ankara, Konya", count: 28, pct: 67 },
  { region: "Ege", city: "İzmir, Manisa", count: 18, pct: 43 },
  { region: "Akdeniz", city: "Antalya, Adana", count: 15, pct: 36 },
  { region: "Karadeniz", city: "Trabzon, Samsun", count: 12, pct: 29 },
  { region: "Güneydoğu Anadolu", city: "Gaziantep, Urfa", count: 9, pct: 21 },
  { region: "Doğu Anadolu", city: "Erzurum, Van", count: 5, pct: 12 },
];

const DEADLINES = [
  { title: "Okul Binası Yapım İşi", agency: "İstanbul İl Milli Eğitim Müd.", days: 9, cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  { title: "Tıbbi Cihaz Alımı", agency: "Ankara Şehir Hastanesi", days: 14, cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  { title: "Yol Yapım ve Onarım İşi", agency: "Karayolları 1. Bölge Müd.", days: 17, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
];

// ── Dashboard Component ────────────────────────────────────────────
export default function DashboardPage() {
  const [aiMsg, setAiMsg] = useState("");
  const [aiThread, setAiThread] = useState([
    { role: "assistant", text: "Size nasıl yardımcı olabilirim? Doğal dilde yazın veya bir seçenek belirtin." },
  ]);

  const sendAi = () => {
    if (!aiMsg.trim()) return;
    const user = aiMsg;
    setAiThread((t) => [...t, { role: "user", text: user }]);
    setAiMsg("");
    setTimeout(() => {
      setAiThread((t) => [...t, { role: "assistant", text: "Analiz ediyorum — sonuçlarınızı birkaç saniye içinde göreceksiniz. Daha fazla detay vermek ister misiniz?" }]);
    }, 800);
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
          <Button variant="outline" size="sm" className="gap-2 h-9">
            <IconFlame className="h-4 w-4 text-orange-500" />
            Hızlı Eylemler
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9">
            <IconDownload className="h-4 w-4" />
            Rapor Dışa Aktar
          </Button>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {KPI_CARDS.map((k) => {
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
              <div className={cn("text-[10px] mt-1.5 font-semibold",
                k.trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>{k.change}</div>
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
            {TOP_TENDERS.map((t) => (
              <div key={t.id} className="px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl flex flex-col items-center justify-center shrink-0 border border-border bg-muted/50 text-xs font-bold">
                    <span className="text-[9px] font-medium text-muted-foreground">uyum</span>
                    <span className="text-sm font-bold leading-none text-foreground">%{t.match}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{t.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] shrink-0 border-primary/40 text-primary bg-primary/5">
                        Eşleşme
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{t.agency}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-foreground">{t.budget}</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <IconCalendar className="h-3 w-3" /> Son: {t.deadline}
                      </span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                        t.daysLeft <= 9 ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        : t.daysLeft <= 15 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      )}>
                        {t.daysLeft} gün kaldı
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Centre — Para Akışı + AI Mini */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

          {/* Para Akışı */}
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div>
                <h2 className="font-heading font-semibold text-sm text-foreground">Para Akışı Analizi</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">₺156.8M · Bu Aylık Toplam Hacim</p>
              </div>
              <Link href="/para-akisi">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                  Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="px-4 pt-3 pb-1">
              <div className="flex gap-4 mb-2">
                {[{ label: "Gelir", color: "#6366f1" }, { label: "Gider", color: "#a78bfa" }].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={CASH_FLOW_DATA} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gGelir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gGider" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    formatter={(v: number) => [`₺${v}K`, ""]}
                  />
                  <Area type="monotone" dataKey="gelir" stroke="#6366f1" strokeWidth={2} fill="url(#gGelir)" dot={false} />
                  <Area type="monotone" dataKey="gider" stroke="#a78bfa" strokeWidth={2} fill="url(#gGider)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Mini donut + sector breakdown */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-border/50">
              <div className="shrink-0" style={{ width: 72, height: 72 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={SECTOR_PIE} cx="50%" cy="50%" innerRadius={20} outerRadius={33} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                      {SECTOR_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                {SECTOR_PIE.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-muted-foreground flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] font-bold text-foreground">%{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Asistanım mini */}
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden flex-1">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                  <IconRobot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="font-heading font-semibold text-sm text-foreground">AI Asistanınız</span>
                <Badge className="text-[9px] px-1.5 py-0 h-[17px] bg-primary text-primary-foreground border-0">BETA</Badge>
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
                  {aiThread[aiThread.length - 1]?.text}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {["Rakip analizi yap", "İhale skoru sorgula", "Şartname özetle"].map((q) => (
                  <button key={q} onClick={() => setAiMsg(q)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium">
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
                <button onClick={sendAi}
                  className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity shrink-0">
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
                <input className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-muted/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="İhale Ara" />
              </div>
              {[
                { icon: IconBolt, label: "Benim Adıma Başvur", badge: "YENİ", badgeCls: "bg-emerald-500 text-white" },
                { icon: IconFileText, label: "Teklif Oluştur", badge: null, badgeCls: "" },
                { icon: IconDownload, label: "Belge Yükle", badge: null, badgeCls: "" },
              ].map((action) => (
                <button key={action.label}
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
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
                Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {DEADLINES.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={cn("h-9 w-9 rounded-lg flex flex-col items-center justify-center shrink-0", d.cls)}>
                    <span className="text-xs font-bold leading-none">{d.days}</span>
                    <span className="text-[9px] font-medium opacity-70">gün</span>
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-semibold text-foreground line-clamp-1">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.agency}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Benim Adıma Başvur premium */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-lg overflow-hidden p-4 text-white relative">
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
            <button className="w-full bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold text-xs py-2 rounded-lg transition-colors">
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
              {KANBAN_COLS.map((col) => (
                <div key={col.title} className="w-[185px] shrink-0">
                  <div className="flex items-center justify-between mb-2.5 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/50">
                    <span className="text-[11px] font-bold text-foreground">{col.title}</span>
                    <span className="text-[11px] font-bold ml-2 px-1.5 py-0.5 rounded-full bg-background border border-border/50 text-muted-foreground">{col.count}</span>
                  </div>
                  <div className="space-y-2">
                    {col.cards.map((card, ci) => (
                      <div key={ci} className="p-2.5 rounded-lg border border-border/50 bg-background hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                        <p className="text-[11px] font-semibold text-foreground line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{card.title}</p>
                        <div className="flex items-center gap-1.5">
                          <IconBuilding className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-[10px] text-muted-foreground truncate">{card.org}</p>
                        </div>
                        <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">{card.budget}</p>
                      </div>
                    ))}
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
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
              Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-4 space-y-3.5">
            {WIN_PREDICTION.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-medium text-foreground line-clamp-1 flex-1 mr-2">{item.name}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-foreground">%{item.pct}</span>
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sektörel Fırsat Haritası */}
        <div className="col-span-12 xl:col-span-3 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h2 className="font-heading font-semibold text-sm text-foreground">Sektörel Fırsat Haritası</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-0.5 text-primary px-2">
              Tümünü Gör <IconChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-4 space-y-2.5">
            {SECTOR_MAP.map((r) => (
              <div key={r.region} className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    backgroundColor: `rgba(99,102,241,${0.12 + (r.pct / 100) * 0.65})`,
                    color: r.pct > 50 ? "#4338ca" : "#6366f1",
                  }}>
                  {r.count}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-foreground">{r.region}</span>
                    <span className="text-[10px] text-muted-foreground">{r.city}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all"
                      style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-14 h-1.5 rounded-full bg-gradient-to-r from-indigo-100 to-indigo-600" />
              </div>
              <span>Düşük → Yüksek</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
