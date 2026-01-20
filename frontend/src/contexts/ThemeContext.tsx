import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode } from "@mui/material";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: PaletteMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "lotus_warden_theme";

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeContextProvider");
  }
  return context;
};

// Get system preference
const getSystemPreference = (): PaletteMode => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
};

// Create theme based on mode
const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            // Dark mode colors
            primary: {
              main: "#90caf9",
            },
            secondary: {
              main: "#ce93d8",
            },
            background: {
              default: "#121212",
              paper: "#1e1e1e",
            },
          }
        : {
            // Light mode colors
            primary: {
              main: "#1976d2",
            },
            secondary: {
              main: "#9c27b0",
            },
            background: {
              default: "#f5f5f5",
              paper: "#ffffff",
            },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
    },
  });

interface ThemeContextProviderProps {
  children: ReactNode;
}

export const ThemeContextProvider = ({ children }: ThemeContextProviderProps) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
    return "dark"; // Default to dark
  });

  const [systemPreference, setSystemPreference] = useState<PaletteMode>(getSystemPreference);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Resolve the actual mode based on preference
  const resolvedMode: PaletteMode = useMemo(() => {
    if (mode === "system") {
      return systemPreference;
    }
    return mode;
  }, [mode, systemPreference]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const newMode = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, toggleMode }}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeContextProvider;
