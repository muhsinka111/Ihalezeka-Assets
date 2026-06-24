import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  problem1: 5000,
  problem2: 5000,
  solution: 7000,
  howItWorks: 12000,
  outro: 6000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  problem1: Scene1,
  problem2: Scene2,
  solution: Scene3,
  howItWorks: Scene4,
  outro: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[var(--color-bg-dark)] font-body text-[var(--color-text-primary)]">
      
      {/* PERSISTENT BACKGROUND LAYER */}
      <div className="absolute inset-0">
        <motion.div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}images/bg_data.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: sceneIndex === 2 || sceneIndex === 4 ? 0 : 0.3,
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div 
          className="absolute inset-0 opacity-0"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}images/bg_network.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: sceneIndex === 2 || sceneIndex === 4 ? 0.4 : 0,
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Animated Gradient Orbs */}
        <motion.div 
          className="absolute w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-20"
          style={{ background: 'var(--color-primary)' }}
          animate={{ 
            x: ['-20%', '50%', '-10%'], 
            y: ['-20%', '30%', '10%'],
            scale: [1, 1.2, 0.8]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div 
          className="absolute w-[40vw] h-[40vw] rounded-full blur-[80px] opacity-10 right-0 bottom-0"
          style={{ background: '#FFFFFF' }}
          animate={{ 
            x: ['20%', '-30%', '10%'], 
            y: ['20%', '-20%', '0%'],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* FOREGROUND SCENES */}
      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      {/* PERSISTENT BRANDING (Subtle) */}
      <motion.div 
        className="absolute top-[4vh] left-[4vw] flex items-center gap-3 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: sceneIndex === 4 ? 0 : 0.8 }}
        transition={{ delay: 1 }}
      >
        <div className="w-8 h-8 rounded bg-[var(--color-primary)] flex items-center justify-center">
          <div className="w-4 h-4 rounded-sm bg-white" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">İhaleZeka</span>
      </motion.div>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
