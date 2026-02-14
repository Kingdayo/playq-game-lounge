import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { WhotCard as WhotCardType, WhotShape, shapeStyles, shapeIcons } from '../lib/whot';
import { cn } from '@/lib/utils';

interface WhotCardProps {
  card: WhotCardType;
  onClick?: () => void;
  isPlayable?: boolean;
  isBack?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  layoutId?: string;
}

const WhotCard: React.FC<WhotCardProps> = ({
  card,
  onClick,
  isPlayable = false,
  isBack = false,
  size = 'md',
  disabled = false,
  layoutId,
}) => {
  const Icon = card ? shapeIcons[card.shape] : null;

  const sizeClasses = {
    sm: 'w-16 h-24 text-xs',
    md: 'w-24 h-36 text-sm',
    lg: 'w-32 h-48 text-base',
  };

  const iconSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  if (isBack) {
    return (
      <motion.div
        layoutId={layoutId}
        className={cn(
          sizeClasses[size],
          "relative rounded-xl border-4 border-white/10 bg-zinc-900 flex items-center justify-center overflow-hidden shadow-2xl"
        )}
      >
        <div className="absolute inset-2 border-2 border-white/5 rounded-lg flex items-center justify-center">
             <Zap className="w-1/2 h-1/2 text-white/10" />
        </div>
        <div className="font-display font-black text-white/20 uppercase tracking-tighter text-xl rotate-[-45deg]">
          WHOT
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={layoutId}
      whileHover={!disabled && isPlayable ? { y: -10, scale: 1.05 } : {}}
      whileTap={!disabled && isPlayable ? { scale: 0.95 } : {}}
      onClick={() => !disabled && isPlayable && onClick?.()}
      className={cn(
        sizeClasses[size],
        "relative rounded-xl border-4 bg-zinc-900 flex flex-col items-center justify-between p-3 cursor-pointer shadow-xl transition-all",
        isPlayable ? "border-primary ring-2 ring-primary/20" : "border-white/10",
        !isPlayable && !disabled && "opacity-60 grayscale-[0.5]",
        disabled && "cursor-not-allowed opacity-50",
        card && `${shapeStyles[card.shape].bg} ${shapeStyles[card.shape].border}`
      )}
    >
        {/* Top left value */}
        <div className={cn("self-start font-black", card && shapeStyles[card.shape].text)}>
            {card.value}
        </div>

        {/* Center Icon */}
        <div className={cn("flex-1 flex items-center justify-center", card && shapeStyles[card.shape].text)}>
            <Icon className={cn(iconSizeClasses[size], "drop-shadow-lg")} strokeWidth={3} />
        </div>

        {/* Bottom right value (rotated) */}
        <div className={cn("self-end font-black rotate-180", card && shapeStyles[card.shape].text)}>
            {card.value}
        </div>

        {/* Special indicator for Whot cards */}
        {card.shape === 'whot' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
                <div className="w-full h-full bg-gradient-to-br from-purple-500/50 to-indigo-500/50 blur-xl rounded-full" />
            </div>
        )}
    </motion.div>
  );
};

export default React.memo(WhotCard);
