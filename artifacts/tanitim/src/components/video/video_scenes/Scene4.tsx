import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Step 1
      setTimeout(() => setPhase(2), 3500),  // Step 2
      setTimeout(() => setPhase(3), 6500),  // Step 3
      setTimeout(() => setPhase(4), 10500), // exit prep
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center px-[10vw]"
      initial={{ clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }}
      animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <h3 className="text-[3vw] text-[var(--color-text-secondary)] font-medium mb-12">Nasıl Çalışır?</h3>

      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-[3vw] top-0 bottom-0 w-1 bg-white/10" />
        <motion.div 
          className="absolute left-[3vw] top-0 w-1 bg-[var(--color-primary)]"
          initial={{ height: 0 }}
          animate={{ height: phase === 1 ? '15%' : phase === 2 ? '50%' : phase >= 3 ? '100%' : '0%' }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />

        {/* Step 1 */}
        <div className="relative pl-[8vw] py-6 mb-4">
          <motion.div 
            className="absolute left-[1.5vw] top-8 w-[3.5vw] h-[3.5vw] rounded-full bg-[var(--color-bg-dark)] border-4 border-[var(--color-primary)] z-10"
            initial={{ scale: 0 }}
            animate={phase >= 1 ? { scale: 1, backgroundColor: phase > 1 ? 'var(--color-primary)' : 'var(--color-bg-dark)' } : { scale: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8 }}
          >
            <h4 className="text-[4vw] font-display font-bold leading-tight">Profilinizi Oluşturun</h4>
            <p className="text-[2vw] text-[var(--color-text-secondary)] mt-2">Sektörünüzü ve kriterlerinizi belirleyin.</p>
          </motion.div>
        </div>

        {/* Step 2 */}
        <div className="relative pl-[8vw] py-6 mb-4">
          <motion.div 
            className="absolute left-[1.5vw] top-8 w-[3.5vw] h-[3.5vw] rounded-full bg-[var(--color-bg-dark)] border-4 border-white/20 z-10"
            initial={{ scale: 0 }}
            animate={phase >= 2 ? { scale: 1, borderColor: 'var(--color-primary)', backgroundColor: phase > 2 ? 'var(--color-primary)' : 'var(--color-bg-dark)' } : { scale: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8 }}
          >
            <h4 className="text-[4vw] font-display font-bold leading-tight">Yapay Zeka Eşleştirsin</h4>
            <p className="text-[2vw] text-[var(--color-text-secondary)] mt-2">Binlerce ihale arasından size uygun olanları seçer.</p>
          </motion.div>
        </div>

        {/* Step 3 */}
        <div className="relative pl-[8vw] py-6">
          <motion.div 
            className="absolute left-[1.5vw] top-8 w-[3.5vw] h-[3.5vw] rounded-full bg-[var(--color-bg-dark)] border-4 border-white/20 z-10"
            initial={{ scale: 0 }}
            animate={phase >= 3 ? { scale: 1, borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary)' } : { scale: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8 }}
          >
            <h4 className="text-[4vw] font-display font-bold leading-tight text-[var(--color-primary)]">Hiçbir Fırsatı Kaçırmayın</h4>
            <p className="text-[2vw] text-[var(--color-text-secondary)] mt-2">Size özel anlık bildirimler alın.</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
