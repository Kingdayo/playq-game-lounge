import { useEffect, useRef } from 'react';

export const usePerformanceMonitor = () => {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const fpsRef = useRef(60);

  useEffect(() => {
    // Global metrics for production debugging
    (window as any).PLAYQ_PERFORMANCE = {
      fps: 60,
      loadTime: 0,
      latency: 0,
      history: [] as number[]
    };

    let animationFrameId: number;

    const calculateFPS = () => {
      const now = performance.now();
      frameCount.current++;

      if (now >= lastTime.current + 1000) {
        fpsRef.current = Math.round((frameCount.current * 1000) / (now - lastTime.current));

        const metrics = (window as any).PLAYQ_PERFORMANCE;
        if (metrics) {
          metrics.fps = fpsRef.current;
          metrics.history.push(fpsRef.current);
          if (metrics.history.length > 60) metrics.history.shift();
        }

        // Log performance metrics
        if (fpsRef.current < 55) {
          console.warn(`[Performance] Low FPS detected: ${fpsRef.current}`);
        }

        frameCount.current = 0;
        lastTime.current = now;
      }

      animationFrameId = requestAnimationFrame(calculateFPS);
    };

    animationFrameId = requestAnimationFrame(calculateFPS);

    // Track page load time
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationTiming) {
      const loadTime = navigationTiming.loadEventEnd - navigationTiming.startTime;
      const metrics = (window as any).PLAYQ_PERFORMANCE;
      if (metrics) metrics.loadTime = loadTime;

      console.log(`[Performance] Page Load Time: ${loadTime.toFixed(2)}ms`);
    }

    // Track input latency (approximate)
    const handleInteraction = (e: UIEvent) => {
      const interactionTime = performance.now();
      const latency = interactionTime - e.timeStamp;

      const metrics = (window as any).PLAYQ_PERFORMANCE;
      if (metrics) metrics.latency = latency;

      if (latency > 100) {
        console.warn(`[Performance] High input latency detected: ${latency.toFixed(2)}ms on ${e.type}`);
      }
    };

    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  return { fps: fpsRef.current };
};
