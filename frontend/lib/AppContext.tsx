"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { mockUser, mockRepos, mockIssues, mockPackages } from "./mock-data";

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
  user: typeof mockUser;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(mockUser);
  const [repos, setRepos] = useState<Repo[]>(mockRepos);
  const [issues, setIssues] = useState<Issue[]>(mockIssues);
  const [packages, setPackages] = useState<Package[]>(mockPackages);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [webhookAlerts, setWebhookAlerts] = useState<WebhookAlert[]>([
    { id: "w_01", timestamp: "10:48 AM", channel: "#security", message: "Audit Scan completed. saas-app health is 34%. 6 issues open.", type: "slack" },
    { id: "w_02", timestamp: "10:48 AM", channel: "mathi@debtmap.io", message: "Vulnerability Summary: 2 critical exposures detected.", type: "email" }
  ]);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  
  // Scanning Simulation States
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

  // Sync state on load in case of hydration mismatches
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (theme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, [theme]);
  
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
      ...prev.slice(0, 14) // keep last 15 items
    ]);

    // Slide in simulated notification card
    showToast(`Incoming Alert sent to ${channel}: "${message.slice(0, 45)}..."`, "info");
  };

  // Recalculate repo health score based on issues dynamically
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

      // Clamp score
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

  // Effect to sync repo health scores whenever issues change
  useEffect(() => {
    setRepos((prevRepos) => recalculateHealthScores(issues, prevRepos));
  }, [issues]);

  // Overall aggregate score calculation
  const overallScore = Math.round(
    repos.reduce((acc, r) => acc + r.health_score, 0) / (repos.length || 1)
  );

  // Upgrade Plan Simulation
  const upgradePlan = (newPlan: typeof mockUser.plan) => {
    setUser((prev) => ({ ...prev, plan: newPlan }));
    showToast(`Successfully upgraded account to ${newPlan.toUpperCase()} plan!`, "success");
    triggerWebhookAlert("billing@debtmap.io", `Account upgraded to ${newPlan.toUpperCase()} tier. Invoice generated.`, "email");
  };

  // Connect Repository Simulation
  const connectRepo = (fullName: string, language: string, generator: string, isPrivate: boolean) => {
    const id = `repo_${Math.random().toString(36).substring(2, 9)}`;
    const newRepo: Repo = {
      id,
      full_name: fullName,
      language,
      default_branch: "main",
      is_private: isPrivate,
      last_scanned_at: new Date().toISOString(),
      health_score: 100, // Starts clean
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      generator,
    };

    setRepos((prev) => [...prev, newRepo]);
    showToast(`Repository ${fullName} connected! Starting automated code audit...`, "info");
    
    // Auto-trigger a scan for the new repo
    triggerScan(id);
  };

  // Full Audit Scanner Simulation
  const triggerScan = async (repoId?: string) => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);

    const targetRepo = repoId ? repos.find((r) => r.id === repoId) : null;
    const repoName = targetRepo ? targetRepo.full_name : "all connected workspaces";

    const logSteps = [
      { progress: 10, log: `[SYSTEM] Initializing repository scan for ${repoName}...` },
      { progress: 25, log: `[INFO] Connecting code parser. Analyzing project tree...` },
      { progress: 40, log: `[INFO] Resolving package.json dependencies against NPM registry database...` },
      { progress: 55, log: `[WARN] Scanning semantic code flows. OWASP top 10 rules applied...` },
      { progress: 75, log: `[INFO] Evaluating credential exposure and secret keys...` },
      { progress: 90, log: `[SUCCESS] Compilation complete. Analyzing results...` },
      { progress: 100, log: `[SUCCESS] Scanning finished. Health scores and metrics updated.` },
    ];

    for (let i = 0; i < logSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
      setScanProgress(logSteps[i].progress);
      setScanLogs((prev) => [...prev, logSteps[i].log]);
    }

    setIsScanning(false);
    showToast(`Scan complete for ${repoName}!`, "success");
    
    // Dispatch Webhook Alerts
    triggerWebhookAlert("#security", `Auditor scan finished for ${repoName}. Clean compilation status.`, "slack");
  };

  // Fix Vulnerability Simulation (Git PR workflow)
  const fixIssueSimulate = async (issueId: string): Promise<boolean> => {
    const targetIssue = issues.find((i) => i.id === issueId);
    if (!targetIssue || targetIssue.status === "fixed") return false;

    // We simulate a async PR creation flow
    return new Promise(async (resolve) => {
      await new Promise((r) => setTimeout(r, 100));
      
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? {
                ...i,
                status: "fixed",
                fix_pr_url: `https://github.com/mathivanan/${i.repo_name}/pull/${Math.floor(
                  Math.random() * 100 + 40
                )}`,
              }
            : i
        )
      );

      showToast(`Pull Request merged successfully! Security issue closed.`, "success");
      triggerWebhookAlert("#security", `Resolved critical risk ${targetIssue.plain_english_title} in ${targetIssue.repo_name}. PR merged.`, "slack");
      triggerWebhookAlert("mathi@debtmap.io", `Vulnerability Fix: ${targetIssue.plain_english_title} has been remediated.`, "email");
      resolve(true);
    });
  };

  // Dismiss Vulnerability
  const dismissIssue = (issueId: string) => {
    const targetIssue = issues.find((i) => i.id === issueId);
    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, status: "dismissed" } : i))
    );
    showToast("Vulnerability dismissed.", "info");
    if (targetIssue) {
      triggerWebhookAlert("#security", `Vulnerability dismissed: ${targetIssue.plain_english_title} in ${targetIssue.repo_name}.`, "slack");
    }
  };

  // Package Safety Resolution Action
  const auditPackageAction = (pkgId: string, action: "verify" | "replace" | "ignore") => {
    const targetPkg = packages.find((p) => p.id === pkgId);
    if (!targetPkg) return;

    if (action === "replace" && targetPkg.alternative_name) {
      // We replace it by removing the dangerous package and adding/verifying the alternative
      setPackages((prev) =>
        prev
          .filter((p) => p.id !== pkgId)
          .map((p) =>
            p.package_name === targetPkg.alternative_name
              ? { ...p, status: "safe", exists_in_registry: true, reason: "Verified alternative swapped in." }
              : p
          )
      );
      showToast(`Replaced ${targetPkg.package_name} with safe package ${targetPkg.alternative_name}!`, "success");
      triggerWebhookAlert("#security", `Replaced slopsquatted package ${targetPkg.package_name} with safe library ${targetPkg.alternative_name}.`, "slack");
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
      showToast(`Dependency package ${targetPkg.package_name} marked as safe!`, "success");
      triggerWebhookAlert("#security", `Manually whitelist approved package ${targetPkg.package_name}.`, "slack");
    } else if (action === "ignore") {
      setPackages((prev) => prev.filter((p) => p.id !== pkgId));
      showToast(`Ignored package safety alert for ${targetPkg.package_name}.`, "info");
    }
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
