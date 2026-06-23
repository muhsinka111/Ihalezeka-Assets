import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { IconArrowRight, IconChartBar, IconRobot, IconShieldCheck } from "@tabler/icons-react";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-8 text-sm font-semibold border border-primary/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Türkiye'nin Lider Kamu İhale İstihbarat Platformu
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-heading font-extrabold tracking-tight mb-8 leading-[1.1] text-foreground"
          >
            İhaleleri Kaçırmayın, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Kazanmaya Odaklanın
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            İhaleZeka, yapay zeka destekli analizleriyle şirketinize en uygun ihaleleri bulur, şartnameleri saniyeler içinde okur ve kazanma oranınızı artırır.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/sign-up">
              <Button size="lg" className="h-14 px-8 text-base font-bold shadow-lg shadow-primary/25 w-full sm:w-auto">
                Hemen Başla <IconArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#fiyatlandirma">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold w-full sm:w-auto">
                Fiyatlandırma
              </Button>
            </Link>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-16 flex flex-wrap justify-center gap-8 md:gap-12 text-sm font-medium text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <IconRobot className="w-5 h-5 text-primary" />
              <span>Yapay Zeka Destekli</span>
            </div>
            <div className="flex items-center gap-2">
              <IconShieldCheck className="w-5 h-5 text-primary" />
              <span>EKAP Entegrasyonu</span>
            </div>
            <div className="flex items-center gap-2">
              <IconChartBar className="w-5 h-5 text-primary" />
              <span>500+ Firma Kullanıyor</span>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-20 relative mx-auto max-w-5xl"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-20 pointer-events-none" />
          <div className="rounded-xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/10 bg-card">
            {/* Browser chrome */}
            <div className="h-9 bg-muted/60 border-b border-border/50 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div className="ml-4 flex-1 max-w-xs h-5 bg-background/70 rounded-md border border-border/40 flex items-center px-2">
                <span className="text-[9px] text-muted-foreground truncate">ihalezeka.com/dashboard</span>
              </div>
            </div>
            <div className="flex" style={{ minHeight: 340 }}>
              {/* Sidebar */}
              <div className="hidden md:flex w-44 flex-col bg-[#14213D] shrink-0 p-3 gap-1">
                <div className="flex items-center gap-1.5 px-2 py-2 mb-2">
                  <span className="font-bold text-white text-xs">İhale</span>
                  <span className="font-bold text-[#2D5BFF] text-xs">Zeka</span>
                </div>
                {[
                  { label: "Gösterge Paneli", active: true },
                  { label: "Fırsatlarım" },
                  { label: "İhale Arama" },
                  { label: "Boru Hattı" },
                  { label: "Rakip Analizi" },
                  { label: "Raporlar" },
                ].map(({ label, active }) => (
                  <div key={label} className={`h-7 rounded-md px-2 flex items-center text-[9px] font-medium ${active ? 'bg-[#2D5BFF] text-white' : 'text-slate-400'}`}>
                    {label}
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div className="flex-1 p-4 md:p-5 bg-slate-50 dark:bg-slate-900 space-y-3 overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-foreground">Hoş geldiniz, Mehmet 👋</div>
                    <div className="text-[9px] text-muted-foreground">Bugün sizin için derlediğimiz özet bilgiler</div>
                  </div>
                  <div className="h-6 px-3 bg-[#2D5BFF] rounded text-[9px] text-white flex items-center font-medium">Hızlı Eylemler</div>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Eşleşen Fırsatlar", value: "128", badge: "+18 bu hafta", color: "text-emerald-500" },
                    { label: "Kazanılan Sözleşmeler", value: "₺28.7M", badge: "+%37 bu ay", color: "text-emerald-500" },
                    { label: "Kazanma Oranı", value: "%37", badge: "+%8 bu ay", color: "text-emerald-500" },
                    { label: "Ort. Uyum Skoru", value: "%85", badge: "+%3 bu ay", color: "text-emerald-500" },
                  ].map(({ label, value, badge, color }) => (
                    <div key={label} className="border border-border rounded-lg p-2 bg-background flex flex-col gap-1">
                      <div className="text-[8px] text-muted-foreground">{label}</div>
                      <div className="text-sm font-bold text-foreground">{value}</div>
                      <div className={`text-[8px] font-medium ${color}`}>{badge}</div>
                    </div>
                  ))}
                </div>
                {/* Two-column content */}
                <div className="grid grid-cols-5 gap-3">
                  {/* Tender list */}
                  <div className="col-span-3 border border-border rounded-lg bg-background p-3 space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-[9px] font-bold text-foreground">En Uygun İhaleler</div>
                      <div className="text-[8px] text-[#2D5BFF] font-medium">Tümünü Gör →</div>
                    </div>
                    {[
                      { name: "Okul Binası Yapım İşi", agency: "İstanbul İl Milli Eğitim", amount: "₺45.000.000", score: 95, days: "8 gün kaldı", daysColor: "bg-rose-100 text-rose-700" },
                      { name: "Tıbbi Cihaz Alımı", agency: "Ankara Şehir Hastanesi", amount: "₺12.500.000", score: 80, days: "14 gün kaldı", daysColor: "bg-amber-100 text-amber-700" },
                      { name: "Yol Yapım ve Onarım İşi", agency: "Karayolları 1. Bölge", amount: "₺28.750.000", score: 75, days: "17 gün kaldı", daysColor: "bg-blue-100 text-blue-700" },
                    ].map(({ name, agency, amount, score, days, daysColor }) => (
                      <div key={name} className="flex items-center gap-2 p-2 rounded border border-border/50 bg-muted/20">
                        <div className="w-8 text-center">
                          <div className="text-[8px] text-muted-foreground leading-none">uyum</div>
                          <div className="text-[10px] font-bold text-[#2D5BFF]">%{score}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-semibold text-foreground truncate">{name}</div>
                          <div className="text-[8px] text-muted-foreground truncate">{agency} · {amount}</div>
                        </div>
                        <div className={`text-[7px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${daysColor}`}>{days}</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart */}
                  <div className="col-span-2 border border-border rounded-lg bg-background p-3">
                    <div className="text-[9px] font-bold text-foreground mb-1">Para Akışı Analizi</div>
                    <div className="text-[8px] text-muted-foreground mb-3">₺156.8M · Bu Aylık Toplam</div>
                    {/* Mini bar chart */}
                    <div className="flex items-end gap-1 h-16 mb-2">
                      {[40, 55, 45, 70, 60, 85, 75].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                          <div className="w-full rounded-t" style={{ height: `${h}%`, background: i === 5 ? '#2D5BFF' : '#2D5BFF20' }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[7px] text-muted-foreground">
                      {["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem"].map(m => <span key={m}>{m}</span>)}
                    </div>
                    <div className="mt-3 space-y-1">
                      {[
                        { label: "Yapım İşleri", pct: "40%", color: "#2D5BFF" },
                        { label: "Hizmet Alımı", pct: "25%", color: "#6366F1" },
                        { label: "Mal Alımı", pct: "20%", color: "#8B5CF6" },
                      ].map(({ label, pct, color }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                          <div className="text-[8px] text-muted-foreground flex-1">{label}</div>
                          <div className="text-[8px] font-medium text-foreground">{pct}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
