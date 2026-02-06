import React from 'react';
import { motion } from 'framer-motion';
import { UnoCard as UnoCardType, UnoColor } from '../lib/uno';
import { cn } from '@/lib/utils';
import {
  SkipForward,
  RefreshCw,
  Plus2,
  Zap,
  Circle
} from 'lucide-react';

interface UnoCardProps {
  card: UnoCardType;
  onClick?: () => void;
  disabled?: boolean;
  isPlayable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isBack?: boolean;
}

const colorMap: Record<UnoColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  wild: 'bg-zinc-900',
};

const UnoCard: React.FC<UnoCardProps> = ({
  card,
  onClick,
  disabled,
  isPlayable,
  size = 'md',
  isBack = false
}) => {
  const sizeClasses = {
    sm: 'w-12 h-20 text-xs',
    md: 'w-24 h-40 text-sm',
    lg: 'w-32 h-52 text-base',
  };

  if (isBack) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: -180, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className={cn(
          "relative rounded-xl border-4 border-white shadow-xl overflow-hidden bg-zinc-900 flex items-center justify-center",
          sizeClasses[size]
        )}
      >
        <div className="absolute inset-2 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center">
            <span className="font-display font-black text-white italic transform -rotate-45 scale-150">UNO</span>
        </div>
      </motion.div>
    );
  }

  const renderValue = () => {
    switch (card.value) {
      case 'skip': return <SkipForward className="w-1/2 h-1/2" />;
      case 'reverse': return <RefreshCw className="w-1/2 h-1/2" />;
      case 'draw2': return <div className="font-black text-3xl">+2</div>;
      case 'draw4': return <div className="font-black text-3xl">+4</div>;
      case 'wild': return <Zap className="w-1/2 h-1/2" />;
      default: return <span className="font-black text-4xl">{card.value}</span>;
    }
  };

  return (
    <motion.div
      layout
      initial={{ scale: 0.5, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0, y: -50 }}
      whileHover={isPlayable && !disabled ? {
        y: -30,
        scale: 1.1,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1), 0 0 20px rgba(255, 255, 255, 0.4)"
      } : {}}
      whileTap={isPlayable && !disabled ? { scale: 0.95 } : {}}
      onClick={!disabled && isPlayable ? onClick : undefined}
      className={cn(
        "relative rounded-xl border-4 border-white shadow-xl overflow-hidden cursor-pointer transition-all duration-300",
        colorMap[card.color],
        sizeClasses[size],
        !isPlayable && !disabled && "opacity-80 grayscale-[0.2]",
        disabled && "opacity-50 cursor-not-allowed",
        isPlayable && "ring-4 ring-primary ring-offset-2 ring-offset-background z-10"
      )}
    >
      {/* Corner Values */}
      <div className="absolute top-1 left-1 font-black text-white leading-none">
        {card.value === 'draw2' ? '+2' : card.value === 'draw4' ? '+4' : card.value === 'wild' ? 'W' : card.value}
      </div>
      <div className="absolute bottom-1 right-1 font-black text-white leading-none transform rotate-180">
         {card.value === 'draw2' ? '+2' : card.value === 'draw4' ? '+4' : card.value === 'wild' ? 'W' : card.value}
      </div>

      {/* Center Circle */}
      <div className="absolute inset-4 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-white drop-shadow-lg">
           {renderValue()}
        </div>
      </div>

      {/* Wild Card Decoration */}
      {card.color === 'wild' && (
        <div className="absolute inset-0 flex flex-wrap opacity-40 pointer-events-none">
            <div className="w-1/2 h-1/2 bg-red-500" />
            <div className="w-1/2 h-1/2 bg-blue-500" />
            <div className="w-1/2 h-1/2 bg-yellow-400" />
            <div className="w-1/2 h-1/2 bg-green-500" />
        </div>
      )}
    </motion.div>
  );
};

export default UnoCard;
