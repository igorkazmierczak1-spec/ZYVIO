import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';

import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  tease: { title: 'Intro', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  battles: { title: 'Battles', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  progression: { title: 'AI and XP', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  community: { title: 'Community', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  outro: { title: 'Google Play', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
};

function formatTime(durationMs: number) {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VideoWithControls() {
  const isIframed = window.self !== window.top;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [controls.tick]);

  useEffect(() => {
    if (controls.paused) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - startedAt);
    }, 60);
    return () => {
      window.clearInterval(timer);
      elapsedBaseRef.current += performance.now() - startedAt;
    };
  }, [controls.paused, controls.tick]);

  useEffect(() => {
    if (!controls.paused) return;
    const animations = document.getAnimations().filter((animation) => animation.playState === 'running');
    animations.forEach((animation) => animation.pause());
    return () => animations.forEach((animation) => animation.play());
  }, [controls.paused]);

  const jumpTo = useCallback((index: number) => {
    controls.jumpTo(index);
    const key = controls.sceneKeys[index];
    const details = SCENE_DETAILS[key];
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: controls.sceneKeys.length,
        sceneTitle: details.title,
        filePath: details.filePath,
        lineNumber: 1,
      },
    }, '*');
  }, [controls]);

  if (!isIframed) return <VideoTemplate />;

  const visible = !collapsed || hovering;
  const progress = Math.min(1, elapsed / controls.activeDuration);
  const totalElapsed = Math.min(
    controls.totalDuration,
    controls.activeStartTime + Math.min(elapsed, controls.activeDuration),
  );

  return (
    <div className="relative w-full h-screen">
      <VideoTemplate
        key={controls.mountKey}
        durations={controls.durations}
        paused={controls.paused}
        muted={muted}
        onSceneChange={controls.onSceneChange}
      />
      <div
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
      >
        <div className="flex-1" />
        <div className={`flex items-center gap-3 bg-black/60 backdrop-blur-md px-5 py-4 transition-all ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <button onClick={controls.togglePause} className="w-14 h-14 grid place-items-center text-white/80" aria-label={controls.paused ? 'Play' : 'Pause'}>
            {controls.paused ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
          </button>
          <button onClick={controls.toggleLock} className={`w-14 h-14 grid place-items-center rounded-lg ${controls.locked ? 'bg-white/15 text-white' : 'text-white/70'}`} aria-label="Loop current scene">
            <Repeat className="w-8 h-8" />
          </button>
          <button onClick={() => setMuted((value) => !value)} className="w-14 h-14 grid place-items-center text-white/70" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
          </button>
          <div className="w-px self-stretch bg-white/15" />
          <div className="flex-1 flex gap-1.5">
            {controls.sceneKeys.map((key, index) => (
              <button
                key={key}
                onClick={() => jumpTo(index)}
                className="relative flex-1 h-3 overflow-hidden rounded-full bg-white/20"
                aria-label={`Jump to scene ${index + 1}`}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  style={{ width: `${index === controls.activeIndex ? progress * 100 : 0}%` }}
                />
              </button>
            ))}
          </div>
          <span className="font-mono text-lg text-white/70">{controls.activeIndex + 1}/{controls.sceneKeys.length}</span>
          <span className="font-mono text-lg text-white/80">{formatTime(totalElapsed)} / {formatTime(controls.totalDuration)}</span>
          <button onClick={() => setCollapsed((value) => !value)} className="w-14 h-14 grid place-items-center text-white/70" aria-label={collapsed ? 'Show controls' : 'Hide controls'}>
            {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
          </button>
        </div>
      </div>
    </div>
  );
}