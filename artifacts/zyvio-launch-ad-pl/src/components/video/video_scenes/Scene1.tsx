import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';
import burstImg from '@assets/generated_images/burst.png';

export function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-70">
         <motion.img 
            src={burstImg}
            className="w-[150vw] max-w-none mix-blend-screen"
            initial={{ scale: 0.8, rotate: -15, opacity: 0 }}
            animate={{ scale: 1.1, rotate: 0, opacity: 0.6 }}
            transition={{ duration: 3, ease: 'easeOut' }}
         />
      </div>

      <SafeFrame>
        <SceneLayout align="center" justify="center">
          <motion.div 
            className="text-center flex flex-col gap-4 relative z-10"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <VideoText 
              as="h1" 
              size="7xl" 
              weight="800"
              className="text-[var(--color-lime)] tracking-tighter uppercase leading-[0.9]"
            >
              Myślisz,<br />
              <span className="text-[var(--color-soft)]">że jesteś</span><br />
              <span className="text-[var(--color-cyan)] italic relative">
                kreatywny?
                <motion.div 
                  className="absolute -bottom-4 left-0 w-full h-[0.8vh] bg-[var(--color-coral)] z-[-1]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.6, ease: 'circOut' }}
                  style={{ originX: 0 }}
                />
              </span>
            </VideoText>
          </motion.div>
        </SceneLayout>
      </SafeFrame>
    </motion.div>
  );
}
