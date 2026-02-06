import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DominoTile as DominoTileType } from '@/lib/dominoes';

interface DominoTileProps {
  tile: DominoTileType;
  orientation?: 'horizontal' | 'vertical';
  isPlayable?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  rotation?: number;
  className?: string;
}

const DominoTile: React.FC<DominoTileProps> = ({
  tile,
  orientation = 'vertical',
  isPlayable = false,
  onClick,
  disabled = false,
  size = 'md',
  rotation = 0,
  className
}) => {
  const isHorizontal = orientation === 'horizontal';

  const sizeClasses = {
    sm: isHorizontal ? 'w-12 h-6' : 'w-6 h-12',
    md: isHorizontal ? 'w-20 h-10' : 'w-10 h-20',
    lg: isHorizontal ? 'w-28 h-14' : 'w-14 h-28',
  };

  const pipPositions = (val: number) => {
    switch (val) {
      case 0: return [];
      case 1: return ['center'];
      case 2: return ['top-right', 'bottom-left'];
      case 3: return ['top-right', 'center', 'bottom-left'];
      case 4: return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      case 5: return ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
      case 6: return ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'];
      case 7: return ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right', 'center'];
      case 8: return ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center'];
      case 9: return ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'center'];
      default: return [];
    }
  };

  const renderSide = (val: number) => (
    <div className="relative w-full h-full p-1 flex items-center justify-center">
      {val > 9 ? (
        <span className="text-zinc-950 font-bold text-lg leading-none">{val}</span>
      ) : (
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-0.5">
          {pipPositions(val).map((pos, idx) => {
            const gridPos = {
              'top-left': 'col-start-1 row-start-1',
              'top-center': 'col-start-2 row-start-1',
              'top-right': 'col-start-3 row-start-1',
              'middle-left': 'col-start-1 row-start-2',
              'middle-right': 'col-start-3 row-start-2',
              'center': 'col-start-2 row-start-2',
              'bottom-left': 'col-start-1 row-start-3',
              'bottom-center': 'col-start-2 row-start-3',
              'bottom-right': 'col-start-3 row-start-3',
            }[pos];
            return (
              <div
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-zinc-950 self-center justify-self-center",
                  gridPos
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      whileHover={isPlayable && !disabled ? {
        scale: 1.1,
        y: -10,
        rotateZ: 2,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 0 15px rgba(var(--primary), 0.3)"
      } : {}}
      whileTap={isPlayable && !disabled ? { scale: 0.95 } : {}}
      onClick={() => !disabled && onClick?.()}
      style={{ rotate: rotation }}
      className={cn(
        "relative flex flex-col bg-stone-100 rounded-md border-2 border-stone-300 shadow-lg cursor-pointer transition-all overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col",
        sizeClasses[size],
        isPlayable && "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950",
        disabled && "opacity-50 cursor-not-allowed grayscale",
        className
      )}
    >
      <div className="flex-1 h-full w-full">
        {renderSide(tile.sideA)}
      </div>
      <div className={cn(
        "bg-stone-300",
        isHorizontal ? "w-0.5 h-full" : "w-full h-0.5"
      )} />
      <div className="flex-1 h-full w-full">
        {renderSide(tile.sideB)}
      </div>
    </motion.div>
  );
};

export default DominoTile;
