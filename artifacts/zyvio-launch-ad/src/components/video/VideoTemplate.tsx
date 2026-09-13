import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  tease: 2500,
  battles: 3500,
  progression: 4000,
  community: 2500,
  outro: 2500,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';

const SCENE_BG = [
  'var(--color-ink)',
  'var(--color-violet)',
  'var(--color-lime)',
  'var(--color-ink)',
  'var(--color-ink)',
];

const SCENE_START_SEC = {
  tease: 0,
  battles: 2.5,
  progression: 6,
  community: 10,
  outro: 12.5,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.48;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const target = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    }
    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
    >
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ backgroundColor: SCENE_BG[sceneIndex] }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: `url('data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E')`, backgroundSize: '100px 100px' }} />
      </motion.div>

      {/* Persistent global accent lines */}
      <motion.div 
        className="absolute w-[150vw] h-[2px] bg-cyan-400 z-10 opacity-30"
        animate={{
           y: sceneIndex === 0 ? '80vh' : sceneIndex === 1 ? '15vh' : sceneIndex === 2 ? '60vh' : sceneIndex === 3 ? '40vh' : '95vh',
           rotate: sceneIndex === 0 ? -15 : sceneIndex === 1 ? 25 : sceneIndex === 2 ? -5 : sceneIndex === 3 ? 45 : 0
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute w-[150vw] h-[2px] bg-coral z-10 opacity-30"
        animate={{
           y: sceneIndex === 0 ? '10vh' : sceneIndex === 1 ? '85vh' : sceneIndex === 2 ? '20vh' : sceneIndex === 3 ? '75vh' : '5vh',
           rotate: sceneIndex === 0 ? 15 : sceneIndex === 1 ? -15 : sceneIndex === 2 ? 10 : sceneIndex === 3 ? -35 : 0
        }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />


      <AnimatePresence mode="popLayout">
        {baseSceneKey === 'tease' && <Scene1 key={currentSceneKey} />}
        {baseSceneKey === 'battles' && <Scene2 key={currentSceneKey} />}
        {baseSceneKey === 'progression' && <Scene3 key={currentSceneKey} />}
        {baseSceneKey === 'community' && <Scene4 key={currentSceneKey} />}
        {baseSceneKey === 'outro' && <Scene5 key={currentSceneKey} />}
      </AnimatePresence>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
