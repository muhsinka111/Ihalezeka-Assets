import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-card pt-16 pb-8 border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="İhaleZeka Logo" className="w-8 h-8 rounded-full bg-primary" />
              <span className="font-heading font-bold text-xl tracking-tight text-foreground">İhaleZeka</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              Türkiye'nin yapay zeka destekli ilk ve en gelişmiş kamu ihale istihbarat platformu. Hedefinize odaklanın, ihaleleri biz bulalım.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold font-heading mb-4 text-foreground">Ürün</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Gösterge Paneli</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">İhale Arama</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Rakip Analizi</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Otomatik Teklif</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold font-heading mb-4 text-foreground">Şirket</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Hakkımızda</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Kariyer</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">İletişim</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Blog</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold font-heading mb-4 text-foreground">Yasal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Gizlilik Politikası</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Kullanım Şartları</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">KVKK Aydınlatma</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Çerez Politikası</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} İhaleZeka. Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-foreground">Twitter</span>
            <span className="cursor-pointer hover:text-foreground">LinkedIn</span>
            <span className="cursor-pointer hover:text-foreground">Instagram</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
