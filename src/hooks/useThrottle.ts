import { useRef, useCallback } from 'react';

export function useThrottle<T extends (...args: any[]) => any>(callback: T, delay: number): (...args: Parameters<T>) => void {
  const lastCall = useRef(0);

  return useCallback((...args: Parameters<T>) => {
    const now = new Date().getTime();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]);
}
