import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 4000), // exit prep
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-start pl-[10vw]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[60vw] relative z-10">
        <h2 className="font-display font-bold text-[5.5vw] leading-[1.1] tracking-tight">
          <motion.span 
            className="block"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            Doğru ihaleyi ararken
          </motion.span>
          <motion.span 
            className="block text-[var(--color-error)]"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            zaman mı kaybediyorsunuz?
          </motion.span>
        </h2>
        
        <motion.div 
          className="mt-8 h-1 bg-[var(--color-error)]"
          initial={{ width: 0 }}
          animate={phase >= 2 ? { width: '40%' } : { width: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
        />
      </div>

      {/* Abstract Search Grid Midground */}
      <div className="absolute right-[5vw] top-[20vh] w-[30vw] h-[60vh] grid grid-cols-3 gap-4 opacity-40">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.div
            key={i}
            className="bg-white/10 rounded-md border border-white/20"
            initial={{ opacity: 0 }}
            animate={phase >= 1 ? { 
              opacity: [0.1, 0.8, 0.1],
              borderColor: ['rgba(255,255,255,0.2)', 'rgba(239,68,68,0.8)', 'rgba(255,255,255,0.2)']
            } : { opacity: 0 }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
