import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';
import clashImg from '@assets/generated_images/clash.png';

export function Scene2() {
  const letters = "BATTLE 1v1".split("");

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
      animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ y: '-100vh', opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
         <motion.img 
            src={clashImg}
            className="w-[140vw] h-auto max-w-none mix-blend-screen opacity-80"
            initial={{ scale: 1.5, rotate: 15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 4, ease: 'easeOut' }}
         />
      </div>

      <SafeFrame>
        <SceneLayout align="center" justify="center">
          <motion.div 
            className="text-center flex flex-col gap-2 relative z-10 w-full"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <VideoText 
              as="h2" 
              size="4xl" 
              weight="600"
              className="text-[var(--color-ink)] bg-[var(--color-lime)] inline-block mx-auto px-6 py-2 rounded-full mb-8 transform -rotate-2"
            >
              Udowodnij to w
            </VideoText>
            
            <div className="flex justify-center flex-wrap">
              {letters.map((char, index) => (
                <motion.span
                  key={index}
                  className="text-[12vw] font-extrabold tracking-tighter text-[var(--color-soft)] leading-none text-shadow-hard"
                  style={{ display: 'inline-block', fontFamily: 'var(--font-display)' }}
                  initial={{ y: 100, opacity: 0, rotateX: -90 }}
                  animate={{ y: 0, opacity: 1, rotateX: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 12,
                    delay: 0.5 + index * 0.05
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </div>
            
            {/* Strike-through effect for extra dynamics */}
            <motion.div 
              className="absolute top-[60%] left-[-10vw] h-[1vh] bg-[var(--color-coral)] z-[-1]"
              initial={{ width: 0 }}
              animate={{ width: '120vw' }}
              transition={{ delay: 1.2, duration: 0.5, ease: 'circOut' }}
              style={{ rotate: -5 }}
            />
          </motion.div>
        </SceneLayout>
      </SafeFrame>
    </motion.div>
  );
}
