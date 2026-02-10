import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface GameCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  playerCount: string;
  gradient: string;
  glowColor: string;
  onClick: () => void;
}

const GameCard = memo(({
  title,
  description,
  icon: Icon,
  playerCount,
  gradient,
  glowColor,
  onClick,
}: GameCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="relative cursor-pointer group"
      onClick={onClick}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"
        style={{ background: gradient }}
      />

      {/* Card */}
      <div
        className="relative glass-card rounded-2xl p-6 h-full overflow-hidden"
        style={{ boxShadow: `0 0 30px ${glowColor}` }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: gradient }}
        />

        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/30"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Icon */}
          <motion.div
            className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
            style={{ background: gradient }}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <Icon className="w-8 h-8 text-white" />
          </motion.div>

          {/* Title */}
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {description}
          </p>

          {/* Player count badge */}
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-medium text-white"
              style={{ background: gradient }}
            >
              {playerCount}
            </span>
          </div>
        </div>

        {/* Hover arrow */}
        <motion.div
          className="absolute bottom-6 right-6 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: gradient }}
          initial={{ x: 0, opacity: 0 }}
          whileHover={{ x: 5, opacity: 1 }}
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
});

GameCard.displayName = 'GameCard';

export default GameCard;
