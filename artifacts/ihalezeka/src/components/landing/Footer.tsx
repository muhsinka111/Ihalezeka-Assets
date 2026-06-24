import { Link } from "wouter";

// Social links are intentionally empty until the brand has real accounts.
// Add a `url` to any entry to make it appear automatically — never invent
// placeholder/fake profile URLs.
const SOCIAL_LINKS: { label: string; url: string }[] = [
  // { label: "LinkedIn", url: "https://www.linkedin.com/company/ihalezeka" },
];

export function Footer() {
  return (
    <footer className="bg-card pt-16 pb-8 border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center mb-6">
              <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg?v=2`} alt="İhaleZeka" className="h-9 w-auto" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              Türkiye'nin yapay zeka destekli ilk ve en gelişmiş kamu ihale istihbarat platformu. Hedefinize odaklanın, ihaleleri biz bulalım.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold font-heading mb-4 text-foreground">Ürün</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#ozellikler" className="hover:text-primary transition-colors">Özellikler</a></li>
              <li><a href="#nasil-calisir" className="hover:text-primary transition-colors">Nasıl Çalışır</a></li>
              <li><a href="#moduller" className="hover:text-primary transition-colors">Modüller</a></li>
              <li><a href="#fiyatlandirma" className="hover:text-primary transition-colors">Fiyatlandırma</a></li>
              <li><a href="/blog" className="hover:text-primary transition-colors">Blog</a></li>
              <li><a href="/uluslararasi-ihaleler" className="hover:text-primary transition-colors">Uluslararası İhaleler</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold font-heading mb-4 text-foreground">Hesap</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Kayıt Ol</Link></li>
              <li><Link href="/sign-in" className="hover:text-primary transition-colors">Giriş Yap</Link></li>
              <li><Link href="/fiyatlandirma" className="hover:text-primary transition-colors">Fiyatlandırma</Link></li>
              <li><Link href="/ihale-arama" className="hover:text-primary transition-colors">İhale Arama</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold font-heading mb-4 text-foreground">Yasal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="/gizlilik" className="hover:text-primary transition-colors">Gizlilik Politikası</a></li>
              <li><a href="/kullanim-sartlari" className="hover:text-primary transition-colors">Kullanım Şartları</a></li>
              <li><a href="/kvkk" className="hover:text-primary transition-colors">KVKK Aydınlatma</a></li>
              <li><a href="/gizlilik#cerez" className="hover:text-primary transition-colors">Çerez Politikası</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} İhaleZeka. Tüm hakları saklıdır.</p>
          {SOCIAL_LINKS.length > 0 && (
            <div className="flex gap-4">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
