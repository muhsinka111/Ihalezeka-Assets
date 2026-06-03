import { Link } from "wouter";
import { IconSearch, IconTrendingUp, IconFileText } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="font-heading font-bold text-xl tracking-tight">İhaleZeka</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost">Giriş Yap</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Kayıt Ol</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="py-24 px-4 text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-6 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Kamu İhale İstihbarat Platformu
          </div>
          <h1 className="text-5xl md:text-6xl font-heading font-bold tracking-tight mb-6 leading-tight">
            İhaleleri Kaçırmayın, <span className="text-primary">Hedefe Odaklanın</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
            İhaleZeka, yapay zeka destekli analizleriyle şirketinize en uygun kamu ihalelerini bulur, teklif süreçlerinizi hızlandırır ve kazanma oranınızı artırır.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 px-8 text-base">Hemen Başlayın</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base bg-card">Daha Fazla Bilgi</Button>
            </Link>
          </div>
        </section>

        <section className="bg-muted/50 py-20 px-4 border-t border-border/50">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-heading font-bold text-center mb-12">Neden İhaleZeka?</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <IconSearch className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Akıllı Eşleştirme</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Şirket profilinizi ve geçmiş iş deneyimlerinizi analiz ederek size en uygun ihaleleri puanlar ve önerir.
                </p>
              </div>
              
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-4">
                  <IconTrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Rakip Analizi</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Rakiplerinizin geçmiş ihalelerdeki kırım oranlarını ve kazanma stratejilerini analiz ederek rekabet avantajı sağlar.
                </p>
              </div>
              
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="h-12 w-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 mb-4">
                  <IconFileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Otomatik Teklif</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  İdari ve teknik şartnameleri saniyeler içinde okuyup analiz ederek taslak teklif belgeleri oluşturur.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t border-border/50 bg-card text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} İhaleZeka. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}