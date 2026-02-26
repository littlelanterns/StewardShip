import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const DEFAULT_THEME = 'captains-quarters';
const DEFAULT_FONT_SCALE = 'default';
const THEME_STORAGE_KEY = 'stewardship-theme';
const FONT_SCALE_STORAGE_KEY = 'stewardship-font-scale';

type FontScale = 'default' | 'large' | 'extra_large';

interface ThemeContextValue {
  theme: string;
  setTheme: (theme: string) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): string {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_THEME;
}

function getInitialFontScale(): FontScale {
  try {
    const stored = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (stored === 'large' || stored === 'extra_large') return stored;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_FONT_SCALE;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [fontScale, setFontScaleState] = useState<FontScale>(getInitialFontScale);

  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setFontScale = useCallback((newScale: FontScale) => {
    setFontScaleState(newScale);
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, newScale);
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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-scale-large', 'font-scale-extra-large');
    if (fontScale === 'large') {
      root.classList.add('font-scale-large');
    } else if (fontScale === 'extra_large') {
      root.classList.add('font-scale-extra-large');
    }
  }, [fontScale]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontScale, setFontScale }}>
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
