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
            {/* DEV BYPASS button — remove and restore sign-up/sign-in links when going to production */}
            <Link href="/dashboard">
              <Button size="lg" className="h-14 px-8 text-base font-bold shadow-lg shadow-primary/25 w-full sm:w-auto">
                Beta Girişi — Geliştirici Erişimi <IconArrowRight className="ml-2 w-5 h-5" />
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
              <span>Gelişmiş Veri Analizi</span>
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
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-20" />
          <div className="rounded-xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/10 bg-card">
            <div className="h-8 bg-muted/50 border-b border-border/50 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <div className="p-4 md:p-8 flex gap-6">
              {/* Sidebar Mock */}
              <div className="hidden md:flex w-48 flex-col gap-4">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="space-y-2 mt-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`h-8 rounded ${i === 1 ? 'bg-primary/10 w-full' : 'bg-muted/50 w-5/6'}`} />
                  ))}
                </div>
              </div>
              {/* Content Mock */}
              <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="h-6 w-48 bg-foreground/10 rounded mb-2" />
                    <div className="h-4 w-32 bg-muted rounded" />
                  </div>
                  <div className="h-10 w-32 bg-primary/20 rounded" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 border border-border rounded-lg p-4 flex flex-col justify-between">
                      <div className="h-4 w-20 bg-muted rounded" />
                      <div className="h-8 w-16 bg-foreground/10 rounded" />
                    </div>
                  ))}
                </div>
                <div className="h-64 border border-border rounded-lg bg-muted/20 p-4">
                  <div className="h-4 w-32 bg-muted rounded mb-4" />
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-10 bg-background rounded border border-border flex items-center px-4">
                        <div className="h-3 w-1/3 bg-muted rounded" />
                        <div className="h-3 w-1/4 bg-primary/20 rounded ml-auto" />
                      </div>
                    ))}
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
