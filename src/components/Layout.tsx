import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MaterialLoading from './MaterialLoading';
import { useLoading } from '@/contexts/LoadingContext';

const Layout: React.FC = () => {
  const location = useLocation();
  const { isLoading, triggerLoading } = useLoading();

  const isInitialMount = React.useRef(true);

  // Handle initial page load and tab navigation loading
  useEffect(() => {
    if (isInitialMount.current) {
      // Significantly reduced initial loading for faster PWA feel
      triggerLoading(800);
      isInitialMount.current = false;
    } else {
      // Fast navigation transitions
      triggerLoading(300);
    }
  }, [location.pathname, triggerLoading]);

  return (
    <div className="min-h-screen bg-background">
      <MaterialLoading isLoading={isLoading} />

      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-dark" />
        <motion.div
          className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl"
          style={{ translateZ: 0 }}
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/5 blur-3xl"
          style={{ translateZ: 0 }}
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-accent/5 blur-3xl"
          style={{ translateZ: 0 }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Sidebar - desktop only */}
      <Sidebar />

      {/* Main content */}
      <main className="relative sm:ml-64 min-h-screen pb-20 sm:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav - mobile only */}
      <BottomNav />
    </div>
  );
};

export default Layout;
