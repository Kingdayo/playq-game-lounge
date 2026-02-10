import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LudoToken } from '@/lib/ludo';

interface TokenProps {
    token: LudoToken;
    isSelectable: boolean;
    onClick: () => void;
    isStacked?: boolean;
}

const Token = memo(({ token, isSelectable, onClick, isStacked }: TokenProps) => {
    const bgColor = token.color === 'red' ? 'bg-red-500' : token.color === 'green' ? 'bg-green-500' : token.color === 'yellow' ? 'bg-yellow-500' : 'bg-blue-500';

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isSelectable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <motion.div
            layoutId={token.id}
            transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8
            }}
            role="button"
            tabIndex={isSelectable ? 0 : -1}
            aria-label={`Token ${token.index + 1} (${token.color})`}
            whileHover={isSelectable ? {
                scale: 1.2,
                z: 10,
                filter: "brightness(1.2) drop-shadow(0 0 8px currentColor)"
            } : {}}
            whileTap={isSelectable ? { scale: 0.9 } : {}}
            onClick={(e) => {
                if (isSelectable) {
                    e.stopPropagation();
                    onClick();
                }
            }}
            onKeyDown={handleKeyDown}
            style={{ willChange: 'transform' }}
            className={cn(
                "w-4 h-4 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full border-2 border-white/40 shadow-lg cursor-pointer focus:outline-none relative group",
                bgColor,
                isSelectable && "ring-4 ring-primary ring-offset-2 ring-offset-zinc-900 z-10",
                isStacked && "w-3 h-3 sm:w-6 sm:h-6 md:w-7 md:h-7 border"
            )}
        >
            {isSelectable && (
                <motion.div
                    layoutId={`${token.id}-glow`}
                    className="absolute -inset-2 bg-primary/30 rounded-full blur-md -z-10"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                />
            )}
        </motion.div>
    );
});

Token.displayName = 'LudoToken';

export default Token;
