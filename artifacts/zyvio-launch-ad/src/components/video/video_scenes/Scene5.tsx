import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';
import zyvioLogo from '@assets/zyvio-logo.svg';

export function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <SafeFrame>
        <SceneLayout align="center" justify="center">
          <motion.div 
            className="flex flex-col items-center justify-center gap-12 w-full h-full"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Logo */}
            <motion.div
              className="bg-[var(--color-soft)] p-8 rounded-3xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.4 }}
              style={{ boxShadow: "0 0 40px rgba(201, 249, 103, 0.4)" }}
            >
              <img src={zyvioLogo} alt="ZYVIO" className="w-[60vw] max-w-[300px]" />
            </motion.div>

            <motion.div
              className="flex flex-col items-center gap-4 text-center mt-[5vh]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <VideoText 
                as="p" 
                size="2xl" 
                weight="600"
                className="text-[var(--color-cyan)] uppercase tracking-widest bg-[rgba(255,255,255,0.1)] px-6 py-2 rounded-full border border-[var(--color-cyan)]"
              >
                Coming soon on Google Play
              </VideoText>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 1.2 }}
              className="mt-[10vh]"
            >
              <VideoText 
                as="p" 
                size="4xl" 
                weight="800"
                className="text-[var(--color-lime)] tracking-tight font-mono"
              >
                zyvio.site
              </VideoText>
            </motion.div>
          </motion.div>
        </SceneLayout>
      </SafeFrame>
    </motion.div>
  );
}
