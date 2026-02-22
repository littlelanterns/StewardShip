import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const DEFAULT_THEME = 'captains-quarters';
const STORAGE_KEY = 'stewardship-theme';

interface ThemeContextValue {
  theme: string;
  setTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Remove any existing theme class
    root.className = root.className
      .split(' ')
      .filter((c) => !c.startsWith('theme-'))
      .join(' ')
      .trim();
    // Apply new theme class
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
