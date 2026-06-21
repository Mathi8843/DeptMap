"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

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

export interface WebhookAlert {
  id: string;
  timestamp: string;
  channel: string;
  message: string;
  type: "slack" | "email";
}

function formatIssue(i: any): Issue {
  return {
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
    created_at: i.created_at,
  };
}

function formatPackage(p: any): Package {
  return {
    id: p.id,
    package_name: p.package_name,
    package_manager: p.package_manager,
    status: p.status,
    exists_in_registry: p.exists_in_registry,
    weekly_downloads: p.weekly_downloads,
    reason: p.reason,
    alternative_name: p.alternative_name,
  };
}

function recalculateHealthScores(currentIssues: Issue[], currentRepos: Repo[]): Repo[] {
  return currentRepos.map((repo) => {
    const repoIssues = currentIssues.filter((i) => i.repo_id === repo.id && i.status === "open");
    let score = 100;
    let crit = 0;
    let high = 0;
    let med = 0;
    let low = 0;

    repoIssues.forEach((issue) => {
      if (issue.severity === "critical") { score -= 28; crit++; }
      else if (issue.severity === "high") { score -= 14; high++; }
      else if (issue.severity === "medium") { score -= 6; med++; }
      else if (issue.severity === "low") { score -= 2; low++; }
    });

    score = Math.max(12, Math.min(100, score));

    return { ...repo, health_score: score, critical_count: crit, high_count: high, medium_count: med, low_count: low };
  });
}

interface DataContextType {
  repos: Repo[];
  issues: Issue[];
  packages: Package[];
  webhookAlerts: WebhookAlert[];
  soc2Report: any;
  trendData: any[];
  overallScore: number;
  connectRepo: (fullName: string, language: string, generator: string, isPrivate: boolean, autoScan?: boolean) => Promise<void>;
  upgradePlan: (newPlan: "free" | "pro" | "team" | "enterprise") => void;
  fixIssueSimulate: (issueId: string) => Promise<boolean>;
  dismissIssue: (issueId: string) => Promise<void>;
  auditPackageAction: (pkgId: string, action: "verify" | "replace" | "ignore") => Promise<void>;
  triggerWebhookAlert: (channel: string, message: string, type: WebhookAlert["type"]) => void;
  fetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({
  children,
  triggerScanRef,
  onNewAlert,
}: {
  children: React.ReactNode;
  triggerScanRef: React.MutableRefObject<(repoId?: string) => Promise<void>>;
  onNewAlert: (alert: WebhookAlert) => void;
}) {
  const { user, login } = useAuth();
  const { showToast } = useToast();

  const [repos, setRepos] = useState<Repo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [webhookAlerts, setWebhookAlerts] = useState<WebhookAlert[]>([
    { id: "w_01", timestamp: "10:48 AM", channel: "#security", message: "Audit Scan completed. saas-app health is 34%. 6 issues open.", type: "slack" },
    { id: "w_02", timestamp: "10:48 AM", channel: "mathi@debtmap.io", message: "Vulnerability Summary: 2 critical exposures detected.", type: "email" },
  ]);
  const [soc2Report, setSoc2Report] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [dbRepos, dbIssues, dbPackages] = await Promise.all([
        apiFetch("/repos"),
        apiFetch("/issues"),
        apiFetch("/packages"),
      ]);
      setRepos(dbRepos);
      setIssues(dbIssues.map(formatIssue));
      setPackages(dbPackages.map(formatPackage));

      try {
        const dbSoc2 = await apiFetch("/soc2");
        setSoc2Report(dbSoc2);
      } catch (err) {
        console.error("Failed to fetch SOC 2 report:", err);
      }

      try {
        const dbTrend = await apiFetch("/trend");
        setTrendData(dbTrend);
      } catch (err) {
        console.error("Failed to fetch trend data:", err);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data from backend:", err);
    }
  }, []);

  // Fetch data when auth initializes
  useEffect(() => {
    if (!user.id) return;
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Recalculate health scores when issues change
  useEffect(() => {
    setRepos((prevRepos) => recalculateHealthScores(issues, prevRepos));
  }, [issues]);

  const overallScore = Math.round(
    repos.reduce((acc, r) => acc + r.health_score, 0) / (repos.length || 1)
  );

  // Webhook trigger
  const triggerWebhookAlert = useCallback((channel: string, message: string, type: WebhookAlert["type"]) => {
    const id = `w_${Math.random().toString(36).substring(2, 9)}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const alert: WebhookAlert = { id, timestamp: time, channel, message, type };
    setWebhookAlerts((prev) => [alert, ...prev.slice(0, 14)]);
    onNewAlert(alert);
  }, [onNewAlert]);

  // Upgrade Plan
  const upgradePlan = (newPlan: typeof user.plan) => {
    login({ ...user, plan: newPlan });
    showToast(`Successfully upgraded account to ${newPlan.toUpperCase()} plan!`, "success");
    triggerWebhookAlert("billing@debtmap.io", `Account upgraded to ${newPlan.toUpperCase()} tier. Invoice generated.`, "email");
  };

  // Connect Repository
  const connectRepo = useCallback(async (fullName: string, language: string, generator: string, isPrivate: boolean, autoScan = true) => {
    try {
      showToast(`Connecting repository ${fullName}...`, "info");
      const newRepo = await apiFetch(`/repos?github_repo_full_name=${encodeURIComponent(fullName)}&generator=${encodeURIComponent(generator)}`, {
        method: "POST",
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
        generator: newRepo.generator || generator,
      }]);
      showToast(`Repository ${fullName} connected!${autoScan ? " Starting automated code audit..." : ""}`, "info");

      if (autoScan) {
        triggerScanRef.current(newRepo.id);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to connect repository", "error");
    }
  }, [showToast, triggerScanRef]);

  // Create GitHub Fix PR
  const fixIssueSimulate = async (issueId: string): Promise<boolean> => {
    try {
      showToast("Creating GitHub Pull Request with fix applied...", "info");
      const result = await apiFetch(`/issues/${issueId}/fix`, { method: "POST" });

      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? { ...i, status: "fixed", fix_pr_url: result.pr_url }
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
            const result = await apiFetch(`/issues/${issueId}/fix?bypass=true`, { method: "POST" });
            setIssues((prev) =>
              prev.map((i) =>
                i.id === issueId
                  ? { ...i, status: "fixed", fix_pr_url: result.pr_url }
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
      await apiFetch(`/issues/${issueId}/dismiss`, { method: "POST" });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status: "dismissed" } : i)));
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
      await apiFetch(`/packages/${pkgId}/action?action=${action}`, { method: "POST" });

      if (action === "ignore") {
        setPackages((prev) => prev.filter((p) => p.id !== pkgId));
        showToast(`Ignored package safety alert.`, "info");
      } else if (action === "verify") {
        setPackages((prev) =>
          prev.map((p) =>
            p.id === pkgId
              ? { ...p, status: "safe", exists_in_registry: true, weekly_downloads: 125000, reason: "Manually verified by workspace administrator" }
              : p
          )
        );
        showToast(`Dependency package marked as safe!`, "success");
      } else if (action === "replace") {
        const dbPackages = await apiFetch("/packages");
        setPackages(dbPackages.map(formatPackage));
        showToast(`Swapped package to safe alternative.`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to perform package action", "error");
    }
  };

  return (
    <DataContext.Provider
      value={{
        repos,
        issues,
        packages,
        webhookAlerts,
        soc2Report,
        trendData,
        overallScore,
        connectRepo,
        upgradePlan,
        fixIssueSimulate,
        dismissIssue,
        auditPackageAction,
        triggerWebhookAlert,
        fetchData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
