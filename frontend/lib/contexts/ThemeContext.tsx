"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface ThemeContextType {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

  const setTheme = useCallback((t: "dark" | "light") => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      if (t === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (theme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
