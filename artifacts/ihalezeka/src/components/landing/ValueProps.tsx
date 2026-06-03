import { motion } from "framer-motion";
import { IconSearch, IconEye, IconBrain, IconTargetArrow } from "@tabler/icons-react";

const features = [
  {
    icon: IconTargetArrow,
    title: "Yapay Zeka Destekli Eşleştirme",
    description: "Şirketinizin geçmiş iş bitirme belgelerini, yetkinliklerini ve profilini analiz ederek kazanma ihtimali en yüksek ihaleleri sizin için bulur."
  },
  {
    icon: IconBrain,
    title: "Akıllı Şartname Analizi",
    description: "Yüzlerce sayfalık idari ve teknik şartnameleri saniyeler içinde tarar, önemli riskleri, tarihleri ve gereksinimleri özetler."
  },
  {
    icon: IconEye,
    title: "Derinlemesine Rakip İstihbaratı",
    description: "Rakiplerinizin geçmiş ihalelerdeki kırım oranlarını, teklif stratejilerini ve favori idarelerini inceleyerek rekabet avantajı sağlar."
  },
  {
    icon: IconSearch,
    title: "Gelişmiş İhale Arama Motoru",
    description: "CPV kodu, tahmini bütçe, idare ve bölge bazlı filtrelerle Türkiye'deki tüm aktif ihaleleri tek ekranda anlık olarak tarayın."
  }
];

export function ValueProps() {
  return (
    <section id="ozellikler" className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6 text-foreground tracking-tight">
            İhale süreçlerinizi <br/>
            <span className="text-primary">otopilota bağlayın</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Manuel arama, şartname okuma ve teklif hazırlama süreçlerine son verin. İhaleZeka, bir uzman analist gibi tüm zor işleri sizin için yapar.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="flex gap-4 md:gap-6 p-6 rounded-2xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
            >
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <feature.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold font-heading mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
