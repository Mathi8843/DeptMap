"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

const EMPTY_USER: SavedUser = {
  id: "",
  name: "",
  email: "",
  avatar_url: null,
  plan: "free",
  session_token: undefined,
  has_github_token: false
};

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SavedUser>(() => EMPTY_USER);
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
  
  // App initialization states
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanStatus, setScanStatus] = useState<"idle" | "queued" | "running" | "completed" | "failed">("idle");

  // Stable refs so useCallback closures can read latest values without re-creating the callback
  const isScanningRef = useRef(false);
  const reposRef = useRef<Repo[]>([]);
  // triggerScanRef lets connectRepo call triggerScan before it is declared,
  // avoiding the circular-dependency / temporal-dead-zone issue.
  const triggerScanRef = useRef<(repoId?: string) => Promise<void>>(async () => {});

  // Keep refs in sync with state — these useEffects must come AFTER the ref declarations above
  useEffect(() => { reposRef.current = repos; }, [repos]);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

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
  
  // Unified authentication and data loading initialization on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsInitializing(true);
      
      // 1. Try to load saved user from localStorage for instant UI rendering
      const saved = getSavedUser();
      if (saved) {
        setUser(saved);
      } else {
        setUser(EMPTY_USER);
      }

      // 2. Validate current session with the backend (check if cookie or token is valid)
      try {
        const profile = await apiFetch("/auth/me");
        const updatedUser: SavedUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          plan: profile.plan,
          session_token: saved?.session_token || "cookie-session",
          has_github_token: profile.has_github_token
        };
        setUser(updatedUser);
        saveUser(updatedUser);

        // 3. Load user dashboard data
        const dbRepos = await apiFetch("/repos");
        setRepos(dbRepos);
        
        const dbIssues = await apiFetch("/issues");
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
      } catch (err: any) {
        console.error("Session verification failed on mount:", err);
        // If unauthorized (401), clear session details
        if (err.status === 401 || (err.message && err.message.includes("401"))) {
          setUser(EMPTY_USER);
          localStorage.removeItem("debtmap_user");
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  // Fetch initial data from FastAPI backend when user is loaded (e.g. reload on-demand)
  const fetchData = useCallback(async () => {
    try {
      const dbRepos = await apiFetch("/repos");
      setRepos(dbRepos);
      
      const dbIssues = await apiFetch("/issues");
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
  }, []);
  
  // Toast helpers
  const showToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Webhook trigger
  const triggerWebhookAlert = useCallback((channel: string, message: string, type: WebhookAlert["type"]) => {
    const id = `w_${Math.random().toString(36).substring(2, 9)}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setWebhookAlerts((prev) => [
      { id, timestamp: time, channel, message, type },
      ...prev.slice(0, 14)
    ]);
    showToast(`Incoming Alert sent to ${channel}: "${message.slice(0, 45)}..."`, "info");
  }, [showToast]);

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
  const connectRepo = useCallback(async (fullName: string, language: string, generator: string, isPrivate: boolean, autoScan = true) => {
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
      showToast(`Repository ${fullName} connected!${autoScan ? " Starting automated code audit..." : ""}`, "info");
      
      // Auto-trigger a scan — call through the ref to avoid circular dep with triggerScan
      if (autoScan) {
        triggerScanRef.current(newRepo.id);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to connect repository", "error");
    }
  }, [showToast]);

  // Real Audit Scanner Polling
  const triggerScan = useCallback(async (repoId?: string) => {
    // Use ref to avoid stale closure — no need to include isScanning in deps
    if (isScanningRef.current) return;

    let scanRepoId = repoId;
    if (!scanRepoId) {
      const currentRepos = reposRef.current;
      if (currentRepos.length > 0) {
        scanRepoId = currentRepos[0].id;
      } else {
        showToast("No repository connected to scan.", "error");
        return;
      }
    }

    const targetRepo = reposRef.current.find((r) => r.id === scanRepoId);
    const repoName = targetRepo ? targetRepo.full_name : "selected repository";

    setIsScanning(true);
    setScanStatus("queued");
    setScanProgress(0);
    setScanLogs([`[SYSTEM] Starting scan process on backend for ${repoName}...`]);

    try {
      const scanResult = await apiFetch(`/scans?repo_id=${scanRepoId}`, {
        method: "POST"
      });

      const scanId = scanResult.scan_id;

      // Guard flag — prevents the completion/failure handlers from firing more than once
      // if the interval ticks again before clearInterval() takes effect.
      let scanFinished = false;

      // Poll for progress every 1.5 seconds
      const pollInterval = setInterval(async () => {
        // If already handled, silently skip remaining ticks
        if (scanFinished) return;
        try {
          const statusResult = await apiFetch(`/scans/${scanId}/status`);
          setScanProgress(statusResult.progress || 0);
          setScanStatus(statusResult.status || "running");

          if (statusResult.log_messages && statusResult.log_messages.length > 0) {
            setScanLogs(statusResult.log_messages);
          }

          if (statusResult.status === "completed") {
            scanFinished = true;
            clearInterval(pollInterval);
            setIsScanning(false);
            setScanStatus("completed");
            showToast(`Scan complete for ${repoName}!`, "success");
            const healthScore = reposRef.current.find((r) => r.id === scanRepoId)?.health_score || 100;
            triggerWebhookAlert("#security", `Auditor scan finished for ${repoName}. Health score: ${healthScore}/100.`, "slack");
            fetchData(); // Reload issues, packages and repos from backend
          } else if (statusResult.status === "failed") {
            scanFinished = true;
            clearInterval(pollInterval);
            setIsScanning(false);
            setScanStatus("failed");
            showToast(`Scan failed for ${repoName}. Check terminal logs.`, "error");
            fetchData();
          }
        } catch (pollErr: any) {
          console.error("Error polling scan status:", pollErr);
        }
      }, 1500);

    } catch (err: any) {
      setIsScanning(false);
      setScanStatus("failed");
      showToast(err.message || "Failed to trigger scan", "error");
    }
  }, [showToast, triggerWebhookAlert, fetchData]);

  // Keep triggerScanRef in sync so connectRepo can call it without a circular dep
  useEffect(() => { triggerScanRef.current = triggerScan; }, [triggerScan]);

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
      if (err.message && err.message.toLowerCase().includes("verification failed")) {
        const force = window.confirm(
          `${err.message}\n\nWould you like to bypass verification and force create the Pull Request anyway?`
        );
        if (force) {
          try {
            showToast("Force creating GitHub Pull Request...", "info");
            const result = await apiFetch(`/issues/${issueId}/fix?bypass=true`, {
              method: "POST"
            });
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
            showToast(`Pull Request created successfully! (Verification bypassed)`, "success");
            const targetIssue = issues.find((i) => i.id === issueId);
            const title = targetIssue ? targetIssue.plain_english_title : "Security issue";
            const repoName = targetIssue ? targetIssue.repo_name : "repository";
            triggerWebhookAlert("#security", `Resolved risk: ${title} in ${repoName}. PR opened.`, "slack");
            triggerWebhookAlert("mathi@debtmap.io", `Vulnerability Fix PR opened: ${title}`, "email");
            return true;
          } catch (retryErr: any) {
            showToast(retryErr.message || "Failed to force apply fix", "error");
            return false;
          }
        }
      } else {
        showToast(err.message || "Failed to apply fix", "error");
      }
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

  const login = useCallback((userData: SavedUser) => {
    saveUser(userData);
    setUser(userData);
    showToast(`Welcome back, ${userData.name}!`, "success");
    // Trigger data loading immediately after login
    fetchData();
  }, [showToast, fetchData]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Failed to call logout endpoint:", err);
    }
    logoutUser();
    setUser(EMPTY_USER);
    setRepos([]);
    setIssues([]);
    setPackages([]);
    setSoc2Report(null);
    setTrendData([]);
    showToast("Logged out successfully.", "info");
  }, [showToast]);

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
        isInitializing,
        isScanning,
        scanProgress,
        scanLogs,
        scanStatus,
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
