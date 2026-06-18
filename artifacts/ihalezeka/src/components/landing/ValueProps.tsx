import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import {
  IconTargetArrow, IconBrain, IconEye, IconSearch,
  IconTrendingUp, IconCheck, IconArrowRight, IconClock,
  IconShieldCheck, IconZoomMoney,
} from "@tabler/icons-react";

// ── Animated counter hook ──────────────────────────────────────────
function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(target);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// ── Mini Mockup Components ─────────────────────────────────────────
function MatchMockup() {
  const items = [
    { title: "Okul Yapım İşi — MEB", match: 95, color: "#10b981" },
    { title: "Altyapı Projesi — KGM", match: 82, color: "#6366f1" },
    { title: "Yazılım Alımı — TÜBİTAK", match: 71, color: "#f59e0b" },
    { title: "Hastane İnşaatı — SB", match: 64, color: "#8b5cf6" },
  ];
  return (
    <div className="space-y-2 w-full">
      {items.map((item, i) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.1 }}
          className="flex items-center gap-2 bg-white/70 dark:bg-white/5 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-border/30 shadow-sm"
        >
          <div className="h-7 w-11 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ backgroundColor: item.color }}>
            %{item.match}
          </div>
          <span className="text-[11px] font-medium text-foreground flex-1 truncate">{item.title}</span>
          <div className="h-1.5 w-16 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${item.match}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.7 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ScanMockup() {
  return (
    <div className="relative bg-white/70 dark:bg-white/5 border border-border/30 rounded-xl p-4 shadow-sm overflow-hidden w-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
          <IconBrain className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
        </div>
        <span className="text-[11px] font-semibold text-foreground">Şartname_Analiz.pdf</span>
        <span className="ml-auto text-[10px] text-muted-foreground">284 sayfa</span>
      </div>
      {/* scan-line animation */}
      <motion.div
        className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-indigo-400 to-violet-400 opacity-80 rounded-full z-10"
        animate={{ top: ["20%", "85%", "20%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="space-y-1.5 relative">
        {[100, 75, 88, 60, 92, 70].map((w, i) => (
          <div key={i} className={`h-1.5 rounded-full`}
            style={{ width: `${w}%`, backgroundColor: i === 1 || i === 3 ? "#fde68a" : "#e5e7eb" }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {[
          { label: "Son: 30 Gün", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" },
          { label: "⚠ 2 Risk", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
          { label: "✓ Uygun", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
        ].map((t) => (
          <span key={t.label} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.color}`}>{t.label}</span>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">Analiz süresi: <span className="font-bold text-indigo-600 dark:text-indigo-400">28 saniye</span></div>
    </div>
  );
}

function CompetitorMockup() {
  const bars = [
    { name: "Sizin Teklifiniz", pct: 78, color: "#6366f1", highlight: true },
    { name: "Rakip A", pct: 52, color: "#94a3b8", highlight: false },
    { name: "Rakip B", pct: 44, color: "#94a3b8", highlight: false },
    { name: "Rakip C", pct: 38, color: "#94a3b8", highlight: false },
  ];
  return (
    <div className="space-y-2 w-full">
      {bars.map((b, i) => (
        <motion.div key={b.name}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.08 }}
          className="flex items-center gap-2"
        >
          <span className={`text-[10px] w-24 shrink-0 truncate font-medium ${b.highlight ? "text-indigo-700 dark:text-indigo-400" : "text-muted-foreground"}`}>{b.name}</span>
          <div className="flex-1 h-5 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <motion.div
              className="h-full rounded-md flex items-center justify-end pr-1.5"
              style={{ backgroundColor: b.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${b.pct}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: "easeOut" }}
            >
              <span className="text-[9px] text-white font-bold">%{b.pct}</span>
            </motion.div>
          </div>
        </motion.div>
      ))}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
        <IconTrendingUp className="h-3 w-3" />
        AI tahminine göre kazanma ihtimaliniz yüksek
      </div>
    </div>
  );
}

function SearchMockup() {
  const results = [
    { badge: "CPV 45000000", title: "Yol Yapım ve Onarım İşi", budget: "₺28.7M", days: 8 },
    { badge: "CPV 72000000", title: "Yazılım Geliştirme Hizmeti", budget: "₺5.2M", days: 14 },
    { badge: "CPV 33100000", title: "Tıbbi Cihaz Alımı", budget: "₺12M", days: 22 },
  ];
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-1.5 bg-white/70 dark:bg-white/5 border border-indigo-200/60 dark:border-indigo-800/40 rounded-lg px-2.5 py-1.5 shadow-sm">
        <IconSearch className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">İnşaat, Ankara, &lt;₺50M…</span>
        <span className="ml-auto text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-semibold">Filtrele</span>
      </div>
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <motion.div key={r.title}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="bg-white/70 dark:bg-white/5 border border-border/30 rounded-lg px-2.5 py-2 flex items-center gap-2 shadow-sm"
          >
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold shrink-0">{r.badge}</span>
            <span className="text-[11px] font-medium text-foreground flex-1 truncate">{r.title}</span>
            <span className="text-[10px] font-bold text-foreground shrink-0">{r.budget}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${r.days <= 10 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{r.days}g</span>
          </motion.div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground text-center pt-0.5">50.000+ aktif ihale · anlık güncelleme</div>
    </div>
  );
}

// ── Stats ──────────────────────────────────────────────────────────
const STATS = [
  { value: 43, suffix: "%", prefix: "+", label: "Ortalama kazanma artışı", icon: IconTrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  { value: 28, suffix: "sn", prefix: "<", label: "Şartname analiz süresi", icon: IconClock, color: "text-indigo-600 dark:text-indigo-400" },
  { value: 50, suffix: "K+", prefix: "", label: "Aktif ihale tabanı", icon: IconSearch, color: "text-violet-600 dark:text-violet-400" },
  { value: 98, suffix: "%", prefix: "", label: "Kullanıcı memnuniyeti", icon: IconShieldCheck, color: "text-blue-600 dark:text-blue-400" },
];

function StatCard({ stat, triggerCount }: { stat: typeof STATS[0]; triggerCount: boolean }) {
  const count = useCounter(stat.value, 1600, triggerCount);
  const Icon = stat.icon;
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div className={`text-3xl md:text-4xl font-extrabold font-heading ${stat.color} tabular-nums`}>
        {stat.prefix}{count}{stat.suffix}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
        <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
      </div>
    </div>
  );
}

// ── Feature Cards ──────────────────────────────────────────────────
const FEATURES = [
  {
    icon: IconTargetArrow,
    badge: "AI Eşleştirme",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    title: "Doğru ihaleler, size özel sıralama",
    description: "Şirket profilinizi, geçmiş kazanımlarınızı ve CPV uzmanlıklarınızı öğrenen model — kazanma şansınız en yüksek ihaleleri önce getirir.",
    stat: { value: "+%43", label: "ortalama kazanma artışı" },
    mockup: <MatchMockup />,
    gradient: "from-emerald-500/10 to-teal-500/5",
    borderColor: "border-emerald-200/60 dark:border-emerald-800/30",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: IconBrain,
    badge: "Şartname Analizi",
    badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
    title: "Yüzlerce sayfa, otuz saniye",
    description: "PDF şartnamelerini yapay zeka saniyeler içinde okur; kritik tarihleri, riskleri, teknik gereksinimleri ve uygunluk koşullarını çıkartır.",
    stat: { value: "<30sn", label: "ortalama analiz süresi" },
    mockup: <ScanMockup />,
    gradient: "from-indigo-500/10 to-violet-500/5",
    borderColor: "border-indigo-200/60 dark:border-indigo-800/30",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400",
  },
  {
    icon: IconEye,
    badge: "Rakip İstihbaratı",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
    title: "Rakibinizin teklifini tahmin edin",
    description: "Geçmiş ihale verilerinden öğrenilen kırım oranları, favori idareler ve teklif stratejileriyle rakip davranışını öngörün.",
    stat: { value: "3,200+", label: "rakip firma analiz edildi" },
    mockup: <CompetitorMockup />,
    gradient: "from-violet-500/10 to-purple-500/5",
    borderColor: "border-violet-200/60 dark:border-violet-800/30",
    iconBg: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
  },
  {
    icon: IconSearch,
    badge: "Akıllı Arama",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    title: "50.000+ ihale, tek aramada",
    description: "CPV kodu, bütçe aralığı, idare, bölge ve kalan süre filtresiyle anlık güncellenmiş EKAP verisi üzerinde saniyeler içinde arama yapın.",
    stat: { value: "50K+", label: "anlık güncellenen ihale" },
    mockup: <SearchMockup />,
    gradient: "from-blue-500/10 to-sky-500/5",
    borderColor: "border-blue-200/60 dark:border-blue-800/30",
    iconBg: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  },
];

// ── Main Section ───────────────────────────────────────────────────
export function ValueProps() {
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-60px" });

  return (
    <section id="ozellikler" className="py-24 bg-background overflow-hidden">
      <div className="container mx-auto px-6 md:px-12">

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mb-5">
            <IconZoomMoney className="h-3.5 w-3.5" />
            NEDEN İHALEZEKA?
          </div>
          <h2 className="text-3xl md:text-5xl font-heading font-extrabold mb-5 text-foreground tracking-tight leading-[1.12]">
            Daha az çalışın,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">
              çok daha fazla kazanın
            </span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Manuel arama, şartname okuma ve rakip tahminine harcadığınız saatleri kaldırın.
            İhaleZeka bunları sizin için saniyeler içinde halleder.
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl mx-auto mb-16 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden divide-x divide-y md:divide-y-0 divide-border/50"
        >
          {STATS.map((s) => (
            <StatCard key={s.label} stat={s} triggerCount={statsInView} />
          ))}
        </motion.div>

        {/* Feature bento grid */}
        <div className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {FEATURES.map((f, idx) => (
            <motion.div
              key={f.badge}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: idx * 0.08, duration: 0.55 }}
              className={`relative rounded-2xl border ${f.borderColor} bg-gradient-to-br ${f.gradient} bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}
            >
              {/* Subtle glow bg */}
              <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-20"
                style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${f.iconBg}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${f.badgeColor}`}>
                      {f.badge}
                    </span>
                    <h3 className="text-base font-bold font-heading text-foreground mt-1 leading-tight">{f.title}</h3>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{f.description}</p>

              {/* Mini mockup */}
              <div className="mb-4">
                {f.mockup}
              </div>

              {/* Stat + CTA row */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <IconCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{f.stat.value}</span>
                  <span className="text-xs text-muted-foreground">{f.stat.label}</span>
                </div>
                <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  Keşfet <IconArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60 border border-border/50 text-sm text-muted-foreground">
            <IconShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            EKAP verisiyle anlık senkronize · 500+ firma kullanıyor · Stripe ile güvenli ödeme
          </div>
        </motion.div>

      </div>
    </section>
  );
}
