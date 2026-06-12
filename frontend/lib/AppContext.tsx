"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch, getSavedUser, saveUser, logoutUser, SavedUser } from "./api";

export interface Repo {
  id: string;
  full_name: string;
  language: string;
  default_branch: string;
  is_private: boolean;
  last_scanned_at: string;
  health_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  generator: string;
}

export interface Issue {
  id: string;
  repo_id: string;
  repo_name: string;
  semgrep_rule_id: string;
  severity: "critical" | "high" | "medium" | "low";
  file_path: string;
  line_start: number;
  line_end: number;
  code_snippet: string;
  plain_english_title: string;
  plain_english_body: string;
  impact_bullets: string[];
  ai_fix_code: string;
  status: "open" | "fixed" | "dismissed";
  fix_pr_url: string | null;
  created_at: string;
}

export interface Package {
  id: string;
  package_name: string;
  package_manager: string;
  status: "safe" | "suspect" | "dangerous" | "unknown";
  exists_in_registry: boolean;
  weekly_downloads: number | null;
  reason: string;
  alternative_name: string | null;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "warning" | "info" | "error";
}

export interface WebhookAlert {
  id: string;
  timestamp: string;
  channel: string;
  message: string;
  type: "slack" | "email";
}

interface AppContextType {
  user: SavedUser;
  repos: Repo[];
  issues: Issue[];
  packages: Package[];
  toasts: Toast[];
  webhookAlerts: WebhookAlert[];
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  showToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
  triggerWebhookAlert: (channel: string, message: string, type: WebhookAlert["type"]) => void;
  
  isScanning: boolean;
  scanProgress: number;
  scanLogs: string[];
  triggerScan: (repoId?: string) => Promise<void>;
  
  connectRepo: (fullName: string, language: string, generator: string, isPrivate: boolean) => void;
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
  const [user, setUser] = useState<SavedUser>({
    id: "00000000-0000-0000-0000-000000000000",
    name: "Mathivanan G",
    email: "mathi@debtmap.io",
    avatar_url: null,
    plan: "pro" as const,
  });
  const [repos, setRepos] = useState<Repo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [webhookAlerts, setWebhookAlerts] = useState<WebhookAlert[]>([
    { id: "w_01", timestamp: "10:48 AM", channel: "#security", message: "Audit Scan completed. saas-app health is 34%. 6 issues open.", type: "slack" },
    { id: "w_02", timestamp: "10:48 AM", channel: "mathi@debtmap.io", message: "Vulnerability Summary: 2 critical exposures detected.", type: "email" }
  ]);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [soc2Report, setSoc2Report] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  
  // Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Apply theme class to HTML root
  const setTheme = (t: "dark" | "light") => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      if (t === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  };

  // Sync state on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (theme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, [theme]);
  
  // Load saved user from localstorage on mount
  useEffect(() => {
    const saved = getSavedUser();
    if (saved) {
      setUser({
        id: saved.id,
        name: saved.name,
        email: saved.email,
        avatar_url: saved.avatar_url,
        plan: saved.plan
      });
    } else {
      // Save default user initially to trigger auto-creation
      const defaultUser: SavedUser = {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Mathivanan G",
        email: "mathi@debtmap.io",
        avatar_url: null,
        plan: "pro" as const
      };
      setUser(defaultUser);
      localStorage.setItem("debtmap_user", JSON.stringify(defaultUser));
    }
  }, []);

  // Fetch initial data from FastAPI backend when user is loaded
  const fetchData = async () => {
    try {
      // Retrieve profile details to check plan and ensure user exists
      const profile = await apiFetch("/auth/me");
      setUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        plan: profile.plan
      });

      const dbRepos = await apiFetch("/repos");
      setRepos(dbRepos);
      
      const dbIssues = await apiFetch("/issues");
      // Format issues to match the frontend shape (mapping snake_case to camelCase where necessary)
      const formattedIssues = dbIssues.map((i: any) => ({
        id: i.id,
        repo_id: i.repo_id,
        repo_name: i.repos?.full_name?.split("/")[1] || "repo",
        semgrep_rule_id: i.semgrep_rule_id,
        severity: i.severity,
        file_path: i.file_path,
        line_start: i.line_start,
        line_end: i.line_end,
        code_snippet: i.code_snippet || "",
        plain_english_title: i.plain_english_title || i.semgrep_rule_id,
        plain_english_body: i.plain_english_body || "A security issue has been found.",
        impact_bullets: i.impact_bullets || [],
        ai_fix_code: i.ai_fix_code || "",
        status: i.status,
        fix_pr_url: i.fix_pr_url,
        created_at: i.created_at
      }));
      console.log(formattedIssues);
      setIssues(formattedIssues);
      
      
      const dbPackages = await apiFetch("/packages");
      const formattedPackages = dbPackages.map((p: any) => ({
        id: p.id,
        package_name: p.package_name,
        package_manager: p.package_manager,
        status: p.status,
        exists_in_registry: p.exists_in_registry,
        weekly_downloads: p.weekly_downloads,
        reason: p.reason,
        alternative_name: p.alternative_name
      }));
      setPackages(formattedPackages);

      // Fetch compliance and trend data
      try {
        const dbSoc2 = await apiFetch("/soc2");
        setSoc2Report(dbSoc2);
      } catch (soc2Err) {
        console.error("Failed to fetch SOC 2 report:", soc2Err);
      }

      try {
        const dbTrend = await apiFetch("/trend");
        setTrendData(dbTrend);
      } catch (trendErr) {
        console.error("Failed to fetch trend data:", trendErr);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data from backend:", err);
    }
  };

  useEffect(() => {
    if (user && user.id) {
      fetchData();
    }
  }, [user.id]);
  
  // Toast helpers
  const showToast = (message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Webhook trigger
  const triggerWebhookAlert = (channel: string, message: string, type: WebhookAlert["type"]) => {
    const id = `w_${Math.random().toString(36).substring(2, 9)}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setWebhookAlerts((prev) => [
      { id, timestamp: time, channel, message, type },
      ...prev.slice(0, 14)
    ]);
    showToast(`Incoming Alert sent to ${channel}: "${message.slice(0, 45)}..."`, "info");
  };

  // Recalculate repo health score dynamically from backend counts (or we can fallback to calculate locally)
  const recalculateHealthScores = (currentIssues: Issue[], currentRepos: Repo[]) => {
    return currentRepos.map((repo) => {
      const repoIssues = currentIssues.filter((i) => i.repo_id === repo.id && i.status === "open");
      
      let score = 100;
      let crit = 0;
      let high = 0;
      let med = 0;
      let low = 0;

      repoIssues.forEach((issue) => {
        if (issue.severity === "critical") {
          score -= 28;
          crit++;
        } else if (issue.severity === "high") {
          score -= 14;
          high++;
        } else if (issue.severity === "medium") {
          score -= 6;
          med++;
        } else if (issue.severity === "low") {
          score -= 2;
          low++;
        }
      });

      score = Math.max(12, Math.min(100, score));

      return {
        ...repo,
        health_score: score,
        critical_count: crit,
        high_count: high,
        medium_count: med,
        low_count: low,
      };
    });
  };

  useEffect(() => {
    setRepos((prevRepos) => recalculateHealthScores(issues, prevRepos));
  }, [issues]);

  const overallScore = Math.round(
    repos.reduce((acc, r) => acc + r.health_score, 0) / (repos.length || 1)
  );

  // Upgrade Plan
  const upgradePlan = (newPlan: typeof user.plan) => {
    setUser((prev) => {
      const updated = { ...prev, plan: newPlan };
      const saved = getSavedUser();
      if (saved) {
        localStorage.setItem("debtmap_user", JSON.stringify({ ...saved, plan: newPlan }));
      }
      return updated;
    });
    showToast(`Successfully upgraded account to ${newPlan.toUpperCase()} plan!`, "success");
    triggerWebhookAlert("billing@debtmap.io", `Account upgraded to ${newPlan.toUpperCase()} tier. Invoice generated.`, "email");
  };

  // Connect Repository
  const connectRepo = async (fullName: string, language: string, generator: string, isPrivate: boolean) => {
    try {
      showToast(`Connecting repository ${fullName}...`, "info");
      const newRepo = await apiFetch(`/repos?github_repo_full_name=${encodeURIComponent(fullName)}&generator=${encodeURIComponent(generator)}`, {
        method: "POST"
      });

      setRepos((prev) => [...prev, {
        id: newRepo.id,
        full_name: newRepo.full_name,
        language: newRepo.language || language,
        default_branch: newRepo.default_branch || "main",
        is_private: newRepo.is_private,
        last_scanned_at: newRepo.last_scanned_at || new Date().toISOString(),
        health_score: newRepo.health_score || 100,
        critical_count: newRepo.critical_count || 0,
        high_count: newRepo.high_count || 0,
        medium_count: newRepo.medium_count || 0,
        low_count: newRepo.low_count || 0,
        generator: newRepo.generator || generator
      }]);
      showToast(`Repository ${fullName} connected! Starting automated code audit...`, "info");
      
      // Auto-trigger a scan for the new repo
      triggerScan(newRepo.id);
    } catch (err: any) {
      showToast(err.message || "Failed to connect repository", "error");
    }
  };

  // Real Audit Scanner Polling
  const triggerScan = async (repoId?: string) => {
    if (isScanning) return;

    let scanRepoId = repoId;
    if (!scanRepoId) {
      if (repos.length > 0) {
        scanRepoId = repos[0].id;
      } else {
        showToast("No repository connected to scan.", "error");
        return;
      }
    }

    const targetRepo = repos.find((r) => r.id === scanRepoId);
    const repoName = targetRepo ? targetRepo.full_name : "selected repository";

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([`[SYSTEM] Starting scan process on backend for ${repoName}...`]);

    try {
      const scanResult = await apiFetch(`/scans?repo_id=${scanRepoId}`, {
        method: "POST"
      });

      const scanId = scanResult.scan_id;

      // Set up a polling interval to fetch progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResult = await apiFetch(`/scans/${scanId}/status`);
          setScanProgress(statusResult.progress || 0);
          
          if (statusResult.log_messages && statusResult.log_messages.length > 0) {
            setScanLogs(statusResult.log_messages);
          }

          if (statusResult.status === "completed") {
            clearInterval(pollInterval);
            setIsScanning(false);
            showToast(`Scan complete for ${repoName}!`, "success");
            triggerWebhookAlert("#security", `Auditor scan finished for ${repoName}. Health score: ${repos.find(r => r.id === scanRepoId)?.health_score || 100}/100.`, "slack");
            fetchData(); // Reload issues, packages and repos from backend
          } else if (statusResult.status === "failed") {
            clearInterval(pollInterval);
            setIsScanning(false);
            showToast(`Scan failed for ${repoName}. Check terminal logs.`, "error");
            fetchData();
          }
        } catch (pollErr: any) {
          console.error("Error polling scan status:", pollErr);
        }
      }, 1500);

    } catch (err: any) {
      setIsScanning(false);
      showToast(err.message || "Failed to trigger scan", "error");
    }
  };

  // Create GitHub Fix PR
  const fixIssueSimulate = async (issueId: string): Promise<boolean> => {
    try {
      showToast("Creating GitHub Pull Request with fix applied...", "info");
      const result = await apiFetch(`/issues/${issueId}/fix`, {
        method: "POST"
      });

      // Update state
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? {
                ...i,
                status: "fixed",
                fix_pr_url: result.pr_url,
              }
            : i
        )
      );

      showToast(`Pull Request merged successfully! Security issue closed.`, "success");
      const targetIssue = issues.find((i) => i.id === issueId);
      const title = targetIssue ? targetIssue.plain_english_title : "Security issue";
      const repoName = targetIssue ? targetIssue.repo_name : "repository";
      triggerWebhookAlert("#security", `Resolved risk: ${title} in ${repoName}. PR opened.`, "slack");
      triggerWebhookAlert("mathi@debtmap.io", `Vulnerability Fix PR opened: ${title}`, "email");
      return true;
    } catch (err: any) {
      showToast(err.message || "Failed to apply fix", "error");
      return false;
    }
  };

  // Dismiss Vulnerability
  const dismissIssue = async (issueId: string) => {
    try {
      await apiFetch(`/issues/${issueId}/dismiss`, {
        method: "POST"
      });
      
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, status: "dismissed" } : i))
      );
      showToast("Vulnerability dismissed.", "info");
      const targetIssue = issues.find((i) => i.id === issueId);
      if (targetIssue) {
        triggerWebhookAlert("#security", `Vulnerability dismissed: ${targetIssue.plain_english_title} in ${targetIssue.repo_name}.`, "slack");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to dismiss issue", "error");
    }
  };

  // Package Safety Resolution Action
  const auditPackageAction = async (pkgId: string, action: "verify" | "replace" | "ignore") => {
    try {
      await apiFetch(`/packages/${pkgId}/action?action=${action}`, {
        method: "POST"
      });

      if (action === "ignore") {
        setPackages((prev) => prev.filter((p) => p.id !== pkgId));
        showToast(`Ignored package safety alert.`, "info");
      } else if (action === "verify") {
        setPackages((prev) =>
          prev.map((p) =>
            p.id === pkgId
              ? {
                  ...p,
                  status: "safe",
                  exists_in_registry: true,
                  weekly_downloads: 125000,
                  reason: "Manually verified by workspace administrator",
                }
              : p
          )
        );
        showToast(`Dependency package marked as safe!`, "success");
      } else if (action === "replace") {
        // Swap simulation
        const dbPackages = await apiFetch("/packages");
        setPackages(dbPackages.map((p: any) => ({
          id: p.id,
          package_name: p.package_name,
          package_manager: p.package_manager,
          status: p.status,
          exists_in_registry: p.exists_in_registry,
          weekly_downloads: p.weekly_downloads,
          reason: p.reason,
          alternative_name: p.alternative_name
        })));
        showToast(`Swapped package to safe alternative.`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to perform package action", "error");
    }
  };

  const login = (userData: SavedUser) => {
    saveUser(userData);
    setUser({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar_url: userData.avatar_url || null,
      plan: userData.plan
    });
    showToast(`Welcome back, ${userData.name}!`, "success");
  };

  const logout = () => {
    logoutUser();
    setUser({
      id: "00000000-0000-0000-0000-000000000000",
      name: "Mathivanan G",
      email: "mathi@debtmap.io",
      avatar_url: null,
      plan: "pro"
    });
    showToast("Logged out successfully.", "info");
  };

  return (
    <AppContext.Provider
      value={{
        user,
        repos,
        issues,
        packages,
        toasts,
        webhookAlerts,
        theme,
        setTheme,
        showToast,
        removeToast,
        triggerWebhookAlert,
        isScanning,
        scanProgress,
        scanLogs,
        triggerScan,
        connectRepo,
        upgradePlan,
        fixIssueSimulate,
        dismissIssue,
        auditPackageAction,
        overallScore,
        soc2Report,
        trendData,
        login,
        logout,
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
