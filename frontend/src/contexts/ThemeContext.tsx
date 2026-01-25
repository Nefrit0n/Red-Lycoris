/**
 * Theme Context - Provides theme management for the application
 *
 * Uses the Lotus Warden Design System themes with support for
 * dark, light, and system preference modes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { ThemeProvider as MuiThemeProvider, PaletteMode } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme, lightTheme } from '../design-system/theme';
import type { ThemeMode } from '../design-system/theme';

// Re-export ThemeMode for convenience
export type { ThemeMode };

interface ThemeContextValue {
  /** Current theme mode setting (light, dark, or system) */
  mode: ThemeMode;
  /** Resolved palette mode (light or dark, never system) */
  resolvedMode: PaletteMode;
  /** Set the theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark modes */
  toggleMode: () => void;
  /** Check if current resolved mode is dark */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'lotus_warden_theme';

/**
 * Hook to access theme mode controls
 *
 * @example
 * const { mode, toggleMode, isDark } = useThemeMode();
 */
export const useThemeMode = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeContextProvider');
  }
  return context;
};

/**
 * Get system color scheme preference
 */
const getSystemPreference = (): PaletteMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'dark'; // Default to dark if can't detect
};

/**
 * Load saved theme preference from localStorage
 */
const getSavedThemeMode = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  }
  return 'dark'; // Default to dark theme
};

interface ThemeContextProviderProps {
  children: ReactNode;
  /** Initial theme mode (overrides saved preference) */
  initialMode?: ThemeMode;
}

/**
 * Theme Context Provider
 *
 * Wraps the application with MUI ThemeProvider using Lotus Warden themes.
 * Handles system preference detection and localStorage persistence.
 *
 * @example
 * <ThemeContextProvider>
 *   <App />
 * </ThemeContextProvider>
 */
export const ThemeContextProvider = ({
  children,
  initialMode,
}: ThemeContextProviderProps) => {
  // Theme mode state
  const [mode, setModeState] = useState<ThemeMode>(
    () => initialMode ?? getSavedThemeMode()
  );

  // System preference state
  const [systemPreference, setSystemPreference] = useState<PaletteMode>(
    getSystemPreference
  );

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  // Resolve the actual palette mode
  const resolvedMode: PaletteMode = useMemo(() => {
    if (mode === 'system') {
      return systemPreference;
    }
    return mode;
  }, [mode, systemPreference]);

  // Computed isDark flag
  const isDark = resolvedMode === 'dark';

  // Set mode and persist to localStorage
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    }
  }, []);

  // Toggle between light and dark (skips system)
  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      // If system mode, toggle to opposite of current resolved
      if (prev === 'system') {
        const newMode = systemPreference === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_STORAGE_KEY, newMode);
        return newMode;
      }
      // Otherwise toggle between light and dark
      const newMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      return newMode;
    });
  }, [systemPreference]);

  // Select the appropriate theme
  const theme = useMemo(() => {
    return resolvedMode === 'dark' ? darkTheme : lightTheme;
  }, [resolvedMode]);

  // Context value
  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      setMode,
      toggleMode,
      isDark,
    }),
    [mode, resolvedMode, setMode, toggleMode, isDark]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeContextProvider;
