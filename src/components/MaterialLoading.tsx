import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CircularProgress from '@mui/material/CircularProgress';

interface MaterialLoadingProps {
  isLoading: boolean;
}

const MaterialLoading: React.FC<MaterialLoadingProps> = ({ isLoading }) => {
  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ willChange: 'opacity' }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-[4px]"
        >
          <div className="relative">
            {/* Outer ring for Material feel with neon glow */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 -m-6 rounded-full bg-primary/20 blur-2xl"
            />

            <CircularProgress
              size={70}
              thickness={4}
              sx={{
                color: 'hsl(var(--primary))',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                },
                filter: 'drop-shadow(0 0 8px hsla(var(--primary), 0.5))',
              }}
            />
          </div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mt-8 flex flex-col items-center"
          >
            <span className="text-sm font-bold tracking-[0.2em] text-primary uppercase font-display">
              Loading
            </span>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0.2, 1, 0.2],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MaterialLoading;
