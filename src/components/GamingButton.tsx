import React from 'react';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const gamingButtonVariants = cva(
  'relative overflow-hidden font-display font-semibold transition-all duration-300 inline-flex items-center justify-center whitespace-nowrap rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'btn-gaming text-primary-foreground',
        secondary: [
          'bg-gradient-to-r from-secondary to-accent',
          'text-white',
          'shadow-neon-purple',
          'hover:shadow-[0_0_30px_hsla(263,70%,58%,0.5)]',
        ],
        accent: [
          'bg-gradient-to-r from-accent to-neon-pink',
          'text-white',
          'shadow-neon-pink',
          'hover:shadow-[0_0_30px_hsla(330,100%,60%,0.5)]',
        ],
        success: [
          'bg-gradient-to-r from-success to-neon-cyan',
          'text-success-foreground',
          'shadow-[0_0_20px_hsla(120,100%,50%,0.3)]',
          'hover:shadow-[0_0_30px_hsla(120,100%,50%,0.5)]',
        ],
        outline: [
          'border-2 border-primary bg-transparent',
          'text-primary',
          'hover:bg-primary/10',
          'hover:shadow-neon-cyan',
        ],
        ghost: [
          'bg-transparent',
          'text-foreground',
          'hover:bg-muted',
          'hover:text-primary',
        ],
      },
      size: {
        sm: 'h-9 px-4 text-sm rounded-lg',
        md: 'h-11 px-6 text-base rounded-xl',
        lg: 'h-14 px-8 text-lg rounded-xl',
        xl: 'h-16 px-10 text-xl rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface GamingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gamingButtonVariants> {
  glowEffect?: boolean;
  pulseEffect?: boolean;
}

const GamingButton = React.forwardRef<HTMLButtonElement, GamingButtonProps>(
  ({ className, variant, size, glowEffect = true, pulseEffect = false, children, ...props }, ref) => {
    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(pulseEffect && 'pulse-glow rounded-xl')}
      >
        <button
          className={cn(gamingButtonVariants({ variant, size }), className)}
          ref={ref}
          {...props}
        >
          {/* Shine effect */}
          <span className="absolute inset-0 overflow-hidden rounded-inherit">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
          </span>

          {/* Content */}
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </button>
      </motion.div>
    );
  }
);

GamingButton.displayName = 'GamingButton';

export { GamingButton, gamingButtonVariants };
