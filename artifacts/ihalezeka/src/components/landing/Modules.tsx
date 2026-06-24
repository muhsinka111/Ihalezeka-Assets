import { motion } from "framer-motion";
import { IconLayoutDashboard, IconListDetails, IconFileText, IconCash, IconChartAreaLine, IconTargetArrow } from "@tabler/icons-react";

const modules = [
  {
    title: "Gösterge Paneli & Fırsatlarım",
    description: "Tüm aktif fırsatlarınızı, yaklaşan son tarihleri ve yapay zeka tarafından şirketinize özel puanlanmış en uygun ihaleleri tek ekranda takip edin.",
    icon: IconLayoutDashboard,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    title: "Otomatik Teklif Oluşturucu",
    description: "İdari ve teknik şartnameleri analiz ederek taslak teklif belgelerinizi saniyeler içinde hazırlar. Hata riskini minimize eder.",
    icon: IconFileText,
    color: "text-[#2D5BFF]",
    bg: "bg-[#EAEFFF]/10"
  },
  {
    title: "Pipeline",
    description: "İhaleleri 'İlgileniliyor', 'Hazırlanıyor', 'Teklif Verildi' ve 'Sonuçlandı' aşamalarında görsel bir kanban panosunda yönetin.",
    icon: IconListDetails,
    color: "text-[#2D5BFF]",
    bg: "bg-[#EAEFFF]/10"
  },
  {
    title: "Para Akışı & Raporlar",
    description: "İhale bazlı gelir/gider, nakit akışı takibi, kazanma oranı performans raporları ve sektörel trend analizleri.",
    icon: IconChartAreaLine,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  },
  {
    title: "Uygunluk Analizi & Skor",
    description: "Her ihale için yapay zeka destekli uygunluk skorunu; kapasite, deneyim ve şartname uyumu gibi faktörlere göre detaylı olarak inceleyin.",
    icon: IconTargetArrow,
    color: "text-amber-500",
    bg: "bg-amber-500/10"
  },
  {
    title: "Merkezi Belge Yönetimi",
    description: "Ticaret sicil, bilanço, iş bitirme gibi tüm şirket belgelerinizi merkezi ve güvenli bir şekilde tek noktadan yönetin.",
    icon: IconFileText,
    color: "text-rose-500",
    bg: "bg-rose-500/10"
  }
];

export function Modules() {
  return (
    <section id="moduller" className="py-24 bg-background">
      <div className="container mx-auto px-6 md:px-12">
        <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6 text-foreground tracking-tight">
              Güçlü Modüller, <br/>
              <span className="text-muted-foreground">Eksiksiz Çözüm</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              İhaleZeka, bir kamu ihalesinin başından sonuna kadar ihtiyacınız olan tüm araçları entegre bir platformda sunar. Başka bir yazılıma ihtiyacınız kalmaz.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-border/50 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${mod.bg} ${mod.color}`}>
                <mod.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold font-heading mb-3 text-foreground">{mod.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {mod.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
