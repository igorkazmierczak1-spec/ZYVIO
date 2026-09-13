import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';
import globeImg from '@assets/generated_images/globe.png';

export function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 2, opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
         <motion.img 
            src={globeImg}
            className="w-[180vw] h-auto max-w-none mix-blend-screen opacity-70"
            initial={{ rotate: -15, scale: 1.2 }}
            animate={{ rotate: 15, scale: 1 }}
            transition={{ duration: 4, ease: 'linear' }}
         />
      </div>

      <SafeFrame>
        <SceneLayout align="center" justify="center">
          <motion.div 
            className="text-center bg-[var(--color-ink)] p-8 rounded-3xl border-4 border-[var(--color-cyan)] max-w-[80vw]"
            initial={{ scale: 0, rotate: 15 }}
            animate={{ scale: 1, rotate: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
            style={{ boxShadow: "8px 8px 0 var(--color-cyan)" }}
          >
            <VideoText 
              as="h2" 
              size="6xl" 
              weight="800"
              className="text-[var(--color-soft)] tracking-tighter uppercase leading-[1.1]"
            >
              Dołącz do <br/>
              <span className="text-[var(--color-lime)]">globalnej</span> <br/>
              społeczności <br/>
              <span className="text-[var(--color-violet)]">twórców</span>
            </VideoText>
          </motion.div>
        </SceneLayout>
      </SafeFrame>
    </motion.div>
  );
}
