import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';
type ColorScheme = 'default' | 'crimson' | 'forest' | 'ocean';

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
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

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('dark', 'light', 'theme-crimson', 'theme-forest', 'theme-ocean');
    
    // Add theme
    if (theme === 'light') {
      root.classList.add('light');
    }
    
    // Add color scheme if not default
    if (colorScheme !== 'default') {
      root.classList.add(`theme-${colorScheme}`);
    }

    localStorage.setItem('playq-theme', theme);
    localStorage.setItem('playq-color-scheme', colorScheme);
  }, [theme, colorScheme]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const setColorScheme = (scheme: ColorScheme) => setColorSchemeState(scheme);

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, setTheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
