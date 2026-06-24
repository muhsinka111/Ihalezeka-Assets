import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-24 h-24 mb-8 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center shadow-[0_0_50px_rgba(45,91,255,0.5)]"
        initial={{ rotate: -90, scale: 0 }}
        animate={phase >= 1 ? { rotate: 0, scale: 1 } : { rotate: -90, scale: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="w-12 h-12 rounded-lg border-4 border-white" />
      </motion.div>

      <h2 className="font-display font-black text-[7vw] leading-none mb-6">
        <motion.span
          className="inline-block"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          İhaleZeka
        </motion.span>
        <motion.span
          className="inline-block ml-4 text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-white"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          ile tanışın.
        </motion.span>
      </h2>

      <div className="flex gap-12 mt-4 text-[2.5vw] font-medium text-[var(--color-text-secondary)]">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ type: 'spring' }}
          className="flex items-center gap-3"
        >
          <div className="w-4 h-4 rounded-full bg-[var(--color-primary)]" />
          EKAP
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <div className="w-4 h-4 rounded-full bg-[var(--color-primary)]" />
          ilan.gov.tr
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ type: 'spring', delay: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="w-4 h-4 rounded-full bg-[var(--color-primary)]" />
          7/24 Tarama
        </motion.div>
      </div>

      <motion.p
        className="mt-12 text-[3vw] font-semibold"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 1 }}
      >
        Size en uygun ihaleleri <span className="text-[var(--color-primary)]">yapay zeka</span> bulsun.
      </motion.p>
    </motion.div>
  );
}
