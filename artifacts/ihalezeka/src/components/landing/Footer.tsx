import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-card pt-16 pb-8 border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center mb-6">
              <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="İhaleZeka" className="h-9 w-auto" />
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
              <li><span className="cursor-default">Gizlilik Politikası</span></li>
              <li><span className="cursor-default">Kullanım Şartları</span></li>
              <li><span className="cursor-default">KVKK Aydınlatma</span></li>
              <li><span className="cursor-default">Çerez Politikası</span></li>
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
