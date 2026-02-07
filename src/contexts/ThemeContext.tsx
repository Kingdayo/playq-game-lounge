import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';
type ColorScheme = 'default' | 'crimson' | 'forest' | 'ocean';

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  colorBlindMode: boolean;
  largeText: boolean;
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setColorBlindMode: (enabled: boolean) => void;
  setLargeText: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('playq-theme');
    return (stored as Theme) || 'dark';
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const stored = localStorage.getItem('playq-color-scheme');
    return (stored as ColorScheme) || 'default';
  });

  const [colorBlindMode, setColorBlindModeState] = useState<boolean>(() => {
    const stored = localStorage.getItem('playq-color-blind');
    return stored === 'true';
  });

  const [largeText, setLargeTextState] = useState<boolean>(() => {
    const stored = localStorage.getItem('playq-large-text');
    return stored === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('dark', 'light', 'theme-crimson', 'theme-forest', 'theme-ocean', 'color-blind', 'large-text');
    
    // Add theme
    if (theme === 'light') {
      root.classList.add('light');
    }
    
    // Add color scheme if not default
    if (colorScheme !== 'default') {
      root.classList.add(`theme-${colorScheme}`);
    }

    // Add accessibility classes
    if (colorBlindMode) {
      root.classList.add('color-blind');
    }
    if (largeText) {
      root.classList.add('large-text');
    }

    localStorage.setItem('playq-theme', theme);
    localStorage.setItem('playq-color-scheme', colorScheme);
    localStorage.setItem('playq-color-blind', String(colorBlindMode));
    localStorage.setItem('playq-large-text', String(largeText));
  }, [theme, colorScheme, colorBlindMode, largeText]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const setColorScheme = (scheme: ColorScheme) => setColorSchemeState(scheme);
  const setColorBlindMode = (enabled: boolean) => setColorBlindModeState(enabled);
  const setLargeText = (enabled: boolean) => setLargeTextState(enabled);

  return (
    <ThemeContext.Provider value={{
      theme,
      colorScheme,
      colorBlindMode,
      largeText,
      setTheme,
      setColorScheme,
      setColorBlindMode,
      setLargeText
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
