import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  avatar: string;
  name: string;
  isActive?: boolean;
  isReady?: boolean;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatar,
  name,
  isActive = false,
  isReady = false,
  isHost = false,
  size = 'md',
  showName = true,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative">
        {/* Glow effect for active player */}
        {isActive && (
          <motion.div
            className="absolute -inset-2 rounded-full bg-primary/30 blur-md"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Avatar */}
        <motion.div
          className={cn(
            'relative rounded-full flex items-center justify-center',
            sizeClasses[size],
            isActive ? 'bg-gradient-primary neon-glow-cyan' : 'bg-gradient-to-br from-muted to-card'
          )}
          whileHover={{ scale: 1.05 }}
          animate={isActive ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {avatar}

          {/* Ready indicator */}
          {isReady && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center"
            >
              <svg className="w-2.5 h-2.5 text-success-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}

          {/* Host crown */}
          {isHost && (
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2"
            >
              <span className="text-lg">👑</span>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Name */}
      {showName && (
        <span
          className={cn(
            'font-medium text-sm truncate max-w-[80px]',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {name}
        </span>
      )}
    </div>
  );
};

export default PlayerAvatar;
