import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)] z-50"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Background flare */}
      <motion.div 
        className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-20 bg-[var(--color-primary)] pointer-events-none"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
      />

      <motion.div
        className="flex items-center gap-6 mb-6 relative z-10"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="w-[10vw] h-[10vw] rounded-2xl bg-[var(--color-primary)] flex items-center justify-center shadow-2xl">
          <div className="w-[5vw] h-[5vw] rounded-md bg-white" />
        </div>
        <h1 className="font-display font-black text-[9vw] tracking-tighter">İhaleZeka</h1>
      </motion.div>

      <motion.p
        className="text-[3vw] font-medium text-[var(--color-text-secondary)] tracking-wide relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8 }}
      >
        Akıllı İhale Takip Platformu.
      </motion.p>
    </motion.div>
  );
}
