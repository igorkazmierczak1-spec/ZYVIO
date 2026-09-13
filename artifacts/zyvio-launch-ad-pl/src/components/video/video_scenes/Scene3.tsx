import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';
import orbImg from '@assets/generated_images/orb.png';

export function Scene3() {
  const steps = [
    { text: "POMYSŁY OD AI", color: "text-[var(--color-cyan)]", bg: "bg-[var(--color-ink)]" },
    { text: "ZDOBYWAJ XP", color: "text-[var(--color-lime)]", bg: "bg-[var(--color-ink)]" },
    { text: "AWANSUJ", color: "text-[var(--color-coral)]", bg: "bg-[var(--color-ink)]" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ y: '100vh' }}
      animate={{ y: 0 }}
      exit={{ scale: 1.2, opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
         <motion.img 
            src={orbImg}
            className="w-[120vw] h-auto max-w-none mix-blend-screen opacity-90 mt-[-20vh]"
            initial={{ y: 50, scale: 0.9 }}
            animate={{ y: -20, scale: 1.05 }}
            transition={{ duration: 4, ease: 'easeInOut' }}
         />
      </div>

      <SafeFrame>
        <SceneLayout align="center" justify="end">
          <div className="flex flex-col gap-[3vh] mb-[15vh] w-full items-center">
            {steps.map((step, i) => (
              <motion.div
                key={step.text}
                className={`px-8 py-4 ${step.bg} rounded-2xl border-2 border-[var(--color-ink)] shadow-[4px_4px_0_var(--color-ink)]`}
                initial={{ x: i % 2 === 0 ? '-100vw' : '100vw', rotate: i % 2 === 0 ? -10 : 10 }}
                animate={{ x: 0, rotate: i % 2 === 0 ? -3 : 3 }}
                transition={{
                  type: "spring",
                  stiffness: 150,
                  damping: 14,
                  delay: 0.3 + i * 0.4
                }}
              >
                <VideoText 
                  as="h3" 
                  size="4xl" 
                  weight="800"
                  className={`${step.color} tracking-tighter uppercase whitespace-nowrap`}
                >
                  {step.text}
                </VideoText>
              </motion.div>
            ))}
          </div>
        </SceneLayout>
      </SafeFrame>
    </motion.div>
  );
}
