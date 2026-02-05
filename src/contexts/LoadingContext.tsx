import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  triggerLoading: (duration?: number) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const triggerLoading = useCallback((duration = 800) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsLoading(true);
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      timeoutRef.current = null;
    }, duration);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading, triggerLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};
