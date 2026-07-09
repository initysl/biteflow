import React from 'react';
import { motion } from 'motion/react';
import { Utensils } from 'lucide-react';

interface SplashscreenProps {
  onComplete: () => void;
}

export default function Splashscreen({ onComplete }: SplashscreenProps) {
  // Automatically trigger complete after animation finishes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3200); // 3.2 seconds duration
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      id='splash-screen'
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className='fixed inset-0 z-50 bg-[#fbf8f3] flex flex-col items-center justify-center font-changa select-none'
    >
      <div className='flex flex-col items-center max-w-sm w-full px-6 text-center space-y-12'>
        {/* Brand & Logo Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className='flex flex-col items-center space-y-4'
        >
          <div className='bg-[#f07c5a] text-white p-4 rounded-2xl shadow-md'>
            <Utensils className='w-10 h-10' />
          </div>
          <div>
            <h1 className='text-4xl font-extrabold tracking-tight text-neutral-900 font-changa'>
              BITEFLOW
            </h1>
            <p className='text-xs uppercase tracking-widest text-[#5fb8b2] font-semibold mt-1'>
              Gourmet Dining Experience
            </p>
          </div>
        </motion.div>

        {/* Custom Video-Replica Loading Animation Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className='relative flex items-center justify-center'
        >
          {/* Horizontal Teal Bar Container */}
          <div className='relative w-56 h-14 bg-[#5fb8b2] rounded-xs flex items-center justify-center overflow-visible shadow-xs'>
            {/* Sliding Vertical Orange Bar */}
            <motion.div
              animate={{
                x: [-90, 90, -90],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className='absolute w-5 h-20 bg-[#f07c5a] rounded-xs shadow-xs z-0'
              style={{ top: '-12px' }} // Centers the taller bar vertically over the horizontal bar
            />

            {/* "LOADING" Text sitting on top of both bars */}
            <span className='relative z-10 text-white font-black tracking-[0.2em] text-sm uppercase text-center pl-[0.2em]'>
              COOKING
            </span>
          </div>
        </motion.div>

        {/* Footer info inside splash screen */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className='text-[11px] text-neutral-400 font-mono tracking-wider'
        >
          CONNECTING TO LIVE BISTRO TABLE STREAM...
        </motion.div>
      </div>
    </motion.div>
  );
}
