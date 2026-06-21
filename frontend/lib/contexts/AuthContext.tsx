"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch, getSavedUser, saveUser, logoutUser, type SavedUser } from "../api";
import { useToast } from "./ToastContext";

const EMPTY_USER: SavedUser = {
  id: "",
  name: "",
  email: "",
  avatar_url: null,
  plan: "free",
  session_token: undefined,
  has_github_token: false,
  is_admin: false,
};

interface AuthContextType {
  user: SavedUser;
  isInitializing: boolean;
  login: (userData: SavedUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SavedUser>(() => EMPTY_USER);
  const [isInitializing, setIsInitializing] = useState(true);
  const { showToast } = useToast();

  // Unified authentication initialization on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsInitializing(true);

      const saved = getSavedUser();
      if (saved) {
        setUser(saved);
      } else {
        setUser(EMPTY_USER);
      }

      try {
        const profile = await apiFetch("/auth/me");
        const updatedUser: SavedUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          plan: profile.plan,
          session_token: saved?.session_token || "cookie-session",
          has_github_token: profile.has_github_token,
          is_admin: profile.is_admin,
        };
        setUser(updatedUser);
        saveUser(updatedUser);
      } catch (err: any) {
        console.error("Session verification failed on mount:", err);
        setUser(EMPTY_USER);
        localStorage.removeItem("debtmap_user");
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback((userData: SavedUser) => {
    saveUser(userData);
    setUser(userData);
    showToast(`Welcome back, ${userData.name}!`, "success");
  }, [showToast]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Failed to call logout endpoint:", err);
    }
    logoutUser();
    setUser(EMPTY_USER);
    showToast("Logged out successfully.", "info");
  }, [showToast]);

  return (
    <AuthContext.Provider value={{ user, isInitializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
