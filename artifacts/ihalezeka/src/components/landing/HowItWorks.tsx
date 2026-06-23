import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Profilinizi Tanımlayın",
    desc: "Sistem, şirketinizin yetkinliklerini, faaliyet alanlarını ve geçmiş işlerini analiz ederek profilinizi oluşturur."
  },
  {
    num: "02",
    title: "Yapay Zeka Eşleştirsin",
    desc: "İhaleZeka her gün yayınlanan binlerce ihaleyi tarar ve sizin kazanma ihtimaliniz olanları %95 isabetle bulur."
  },
  {
    num: "03",
    title: "Teklifinizi Hazırlayın",
    desc: "Otomatik teklif oluşturucu ve belge yönetimi ile günlerce süren evrak işlerini dakikalar içinde tamamlayın."
  },
  {
    num: "04",
    title: "Kazanın ve Büyüyün",
    desc: "Rakip analizleri ve doğru fiyatlama stratejileriyle ihale kazanma oranınızı artırın ve gelirinizi yükseltin."
  }
];

export function HowItWorks() {
  return (
    <section id="nasil-calisir" className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
      {/* Decorative patterns */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -mr-[400px] -mt-[400px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-black/10 rounded-full blur-3xl -ml-[300px] -mb-[300px] pointer-events-none" />
      
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6 tracking-tight">
            Nasıl Çalışır?
          </h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Karmaşık ihale süreçlerini 4 basit adıma indirdik. Sadece işinize odaklanın, geri kalanını İhaleZeka halletsin.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, duration: 0.5 }}
              className="relative"
            >
              {/* Connector Line */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-full h-[1px] bg-primary-foreground/20" />
              )}
              
              <div className="bg-white/10 backdrop-blur-md w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold font-heading mb-6 border border-white/20 relative z-10">
                {step.num}
              </div>
              <h3 className="text-xl font-bold font-heading mb-3">{step.title}</h3>
              <p className="text-primary-foreground/70 text-sm leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
