"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface ThemeContextType {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("debtmap-theme") as "dark" | "light" | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeState(savedTheme);
      }
    }
  }, []);

  const setTheme = useCallback((t: "dark" | "light") => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("debtmap-theme", t);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
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
