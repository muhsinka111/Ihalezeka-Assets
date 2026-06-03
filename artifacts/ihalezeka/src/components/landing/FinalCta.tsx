import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function FinalCta() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 md:px-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-card border border-border rounded-[2.5rem] p-10 md:p-20 text-center relative overflow-hidden shadow-2xl"
        >
          {/* Subtle noise/texture backdrop can be applied via CSS if needed, using simple gradient here */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-heading font-extrabold mb-6 tracking-tight text-foreground">
              İhalelerde Rekabet Avantajını <span className="text-primary">Elinize Alın</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Bugün ücretsiz kayıt olun, şirketinize özel ihale fırsatlarını anında görmeye başlayın. Kredi kartı gerekmez.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="h-14 px-10 text-base font-bold w-full sm:w-auto shadow-lg shadow-primary/20">
                  Ücretsiz Hesabınızı Oluşturun
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button variant="outline" size="lg" className="h-14 px-10 text-base font-bold w-full sm:w-auto border-border">
                  Giriş Yap
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground font-medium">
              14 gün ücretsiz deneme. İptal etmek her zaman kolay.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
