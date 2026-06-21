"use client";
import React, { createContext, useContext, useCallback } from "react";
import type { SavedUser } from "./api";
import { useTheme } from "./contexts/ThemeContext";
import { useToast, type Toast } from "./contexts/ToastContext";
import { useAuth } from "./contexts/AuthContext";
import { useData, type WebhookAlert } from "./contexts/DataContext";
import { useScan } from "./contexts/ScanContext";

export type { Repo, Issue, Package } from "./contexts/DataContext";
export type { Toast } from "./contexts/ToastContext";
export type { WebhookAlert } from "./contexts/DataContext";

interface AppContextType {
  user: SavedUser;
  repos: import("./contexts/DataContext").Repo[];
  issues: import("./contexts/DataContext").Issue[];
  packages: import("./contexts/DataContext").Package[];
  toasts: Toast[];
  webhookAlerts: WebhookAlert[];
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  showToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
  triggerWebhookAlert: (channel: string, message: string, type: WebhookAlert["type"]) => void;

  isInitializing: boolean;
  isScanning: boolean;
  scanProgress: number;
  scanLogs: string[];
  scanStatus: "idle" | "queued" | "running" | "completed" | "failed";
  triggerScan: (repoId?: string) => Promise<void>;

  connectRepo: (fullName: string, language: string, generator: string, isPrivate: boolean, autoScan?: boolean) => void;
  upgradePlan: (newPlan: "free" | "pro" | "team" | "enterprise") => void;
  fixIssueSimulate: (issueId: string) => Promise<boolean>;
  dismissIssue: (issueId: string) => void;
  auditPackageAction: (pkgId: string, action: "verify" | "replace" | "ignore") => void;
  overallScore: number;
  soc2Report: any;
  trendData: any[];
  login: (userData: SavedUser) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { toasts, showToast, removeToast } = useToast();
  const { user, isInitializing, login, logout } = useAuth();
  const {
    repos, issues, packages, webhookAlerts,
    soc2Report, trendData, overallScore,
    connectRepo: dataConnectRepo,
    upgradePlan: dataUpgradePlan,
    fixIssueSimulate: dataFixIssueSimulate,
    dismissIssue: dataDismissIssue,
    auditPackageAction,
    triggerWebhookAlert,
    fetchData,
  } = useData();
  const {
    isScanning, scanProgress, scanLogs, scanStatus, triggerScan,
  } = useScan();

  const appLogin = useCallback((userData: SavedUser) => {
    login(userData);
    fetchData();
  }, [login, fetchData]);

  const appLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <AppContext.Provider
      value={{
        user, repos, issues, packages, toasts, webhookAlerts,
        theme, setTheme, showToast, removeToast, triggerWebhookAlert,
        isInitializing,
        isScanning, scanProgress, scanLogs, scanStatus, triggerScan,
        connectRepo: dataConnectRepo,
        upgradePlan: dataUpgradePlan,
        fixIssueSimulate: dataFixIssueSimulate,
        dismissIssue: dataDismissIssue,
        auditPackageAction,
        overallScore, soc2Report, trendData,
        login: appLogin, logout: appLogout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppContextProvider");
  }
  return context;
}
