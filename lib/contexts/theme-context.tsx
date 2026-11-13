'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { THEME_COOKIE_NAME, type Theme } from '@/lib/theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function setThemeCookie(theme: Theme) {
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * `initialTheme` is the theme the root layout read from the cookie (light for
 * anyone who has not chosen), so the server's markup and the first paint
 * already have it.
 */
export function ThemeProvider({ children, initialTheme }: React.PropsWithChildren<{ initialTheme: Theme }>) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    
    // Also update body class for gradient background
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setThemeCookie(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
