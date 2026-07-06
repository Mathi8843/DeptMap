"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Users, GitBranch, Terminal, ShieldAlert, 
  RefreshCw, Lock, AlertTriangle, Package, Sparkles, 
  AlertOctagon, Calendar, Shield, UserPlus
} from "lucide-react";

interface AdminInsights {
  stats: {
    total_users: number;
    total_repos: number;
    total_scans: number;
    total_issues: number;
    total_packages: number;
    avg_health_score: number;
    dangerous_packages_count: number;
  };
  plans: {
    free: number;
    pro: number;
    team: number;
    enterprise: number;
  };
  languages: Record<string, number>;
  generators: Record<string, number>;
  scan_status: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    retrying: number;
  };
  recent_scans: Array<{
    id: string;
    repo_name: string;
    status: string;
    findings_count: number;
    triggered_at: string;
  }>;
  recent_users: Array<{
    id: string;
    email: string;
    name: string;
    plan: string;
    created_at: string;
  }>;
  top_vulnerable_repos: Array<{
    id: string;
    repo_name: string;
    health_score: number;
    critical_count: number;
    high_count: number;
    created_at: string;
    user_name: string;
    user_email: string;
  }>;
  issue_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issue_status: {
    open: number;
    resolved: number;
    dismissed: number;
    fixed: number;
  };
  common_vulnerabilities: Array<{
    title: string;
    rule_id: string;
    count: number;
  }>;
  package_status: {
    safe: number;
    suspect: number;
    dangerous: number;
    unknown: number;
  };
  dangerous_packages: Array<{
    id: string;
    package_name: string;
    package_manager: string;
    status: string;
    reason: string;
    repo_name: string;
    checked_at: string;
  }>;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "security" | "users">("overview");

  const fetchInsights = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetch("/admin/insights");
      setInsights(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load administrative insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const isAdmin = user?.is_admin;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 max-w-md mx-auto text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <Lock size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display font-extrabold text-2xl text-text-main">Access Denied</h1>
          <p className="text-sm text-text-muted leading-relaxed">
            You do not have administrative permissions to view this dashboard. Access is restricted to authorized credentials.
          </p>
        </div>
        <div className="text-xs text-text-muted bg-bg-card border border-border-subtle px-4 py-2.5 rounded-xl">
          Logged in as: <span className="font-mono text-text-main font-bold">{user?.email || "No Email"}</span>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <AlertTriangle size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display font-extrabold text-2xl text-text-main">Error Loading Dashboard</h1>
          <p className="text-sm text-rose-400/90 leading-relaxed bg-rose-500/5 border border-rose-500/10 rounded-xl p-4">
            {errorMsg}
          </p>
        </div>
        <button
          onClick={fetchInsights}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] font-bold tracking-[1px] uppercase rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/25 active:scale-95"
        >
          <RefreshCw size={12} /> Retry Connection
        </button>
      </div>
    );
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 70) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
              Admin Insights
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              System Admin
            </span>
          </div>
          <p className="text-sm text-text-sub">
            System overview, user licenses, and vulnerability metrics
          </p>
        </div>
        
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-text-main hover:text-white rounded-xl transition-all cursor-pointer font-mono text-[10px] font-bold tracking-[1.2px] uppercase active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh Stats"}
        </button>
      </div>

      {loading && !insights ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-text-muted">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest text-indigo-400">Compiling admin insights...</span>
        </div>
      ) : insights ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5 bg-white/5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Total Users</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_users}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5 bg-white/5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <GitBranch size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Repos Audited</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_repos}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5 bg-white/5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Terminal size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Total Scans</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_scans}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5 bg-white/5">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Vulnerabilities</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_issues}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5 bg-white/5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-display font-extrabold text-lg ${getHealthColor(insights.stats.avg_health_score)}`}>
                {insights.stats.avg_health_score}
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Avg Health Score</p>
                <h3 className="font-display font-extrabold text-lg text-text-main mt-0.5">
                  {insights.stats.avg_health_score >= 80 ? "Good Health" : "Needs Review"}
                </h3>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 pb-px gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 font-medium text-sm transition-all border-b-2 font-mono uppercase tracking-wider ${
                activeTab === "overview"
                  ? "border-indigo-500 text-text-main"
                  : "border-transparent text-text-muted hover:text-text-sub"
              }`}
            >
              Overview & Charts
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`pb-3 font-medium text-sm transition-all border-b-2 font-mono uppercase tracking-wider ${
                activeTab === "security"
                  ? "border-indigo-500 text-text-main"
                  : "border-transparent text-text-muted hover:text-text-sub"
              }`}
            >
              Vulnerability & Package Audit
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 font-medium text-sm transition-all border-b-2 font-mono uppercase tracking-wider ${
                activeTab === "users"
                  ? "border-indigo-500 text-text-main"
                  : "border-transparent text-text-muted hover:text-text-sub"
              }`}
            >
              User Accounts & Logs
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* User Plan Breakdown */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-text-main">
                      Subscriptions Model
                    </h3>
                    <Users size={16} className="text-text-muted" />
                  </div>
                  <div className="space-y-3.5 pt-2">
                    {Object.entries(insights.plans).map(([plan, count]) => {
                      const percent = insights.stats.total_users > 0 
                        ? Math.round((count / insights.stats.total_users) * 100) 
                        : 0;
                      return (
                        <div key={plan} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="capitalize text-text-sub">{plan}</span>
                            <span className="text-text-main font-mono">{count} ({percent}%)</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              style={{ width: `${percent}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                plan === "enterprise" ? "bg-amber-400" :
                                plan === "team" ? "bg-indigo-400" :
                                plan === "pro" ? "bg-emerald-400" : "bg-slate-400"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scan Status Breakdown */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-text-main">
                      Scan Engine Health
                    </h3>
                    <Terminal size={16} className="text-text-muted" />
                  </div>
                  <div className="space-y-3.5 pt-2">
                    {Object.entries(insights.scan_status).map(([status, count]) => {
                      const percent = insights.stats.total_scans > 0 
                        ? Math.round((count / insights.stats.total_scans) * 100) 
                        : 0;
                      return (
                        <div key={status} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="capitalize text-text-sub font-mono">{status}</span>
                            <span className="text-text-main font-mono">{count} ({percent}%)</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              style={{ width: `${percent}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                status === "completed" ? "bg-emerald-400" :
                                status === "failed" ? "bg-rose-500" :
                                status === "running" ? "bg-indigo-500" :
                                status === "retrying" ? "bg-amber-500" : "bg-slate-400"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Severity Distribution */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-text-main">
                      Vulnerability Severities
                    </h3>
                    <ShieldAlert size={16} className="text-text-muted" />
                  </div>
                  <div className="space-y-3.5 pt-2">
                    {Object.entries(insights.issue_severity).map(([severity, count]) => {
                      const percent = insights.stats.total_issues > 0 
                        ? Math.round((count / insights.stats.total_issues) * 100) 
                        : 0;
                      return (
                        <div key={severity} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="capitalize text-text-sub font-mono">{severity}</span>
                            <span className="text-text-main font-mono">{count} ({percent}%)</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              style={{ width: `${percent}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                severity === "critical" ? "bg-rose-600" :
                                severity === "high" ? "bg-rose-500" :
                                severity === "medium" ? "bg-amber-400" : "bg-indigo-400"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Advanced Insights Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Languages Breakdown */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <h3 className="font-display font-bold text-base text-text-main">
                    Top Code Languages
                  </h3>
                  <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
                    {Object.keys(insights.languages).length === 0 ? (
                      <p className="text-xs text-text-muted font-mono">No language data available</p>
                    ) : (
                      Object.entries(insights.languages)
                        .sort((a, b) => b[1] - a[1])
                        .map(([lang, count]) => {
                          const percent = insights.stats.total_repos > 0 
                            ? Math.round((count / insights.stats.total_repos) * 100) 
                            : 0;
                          return (
                            <div key={lang} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-text-sub font-mono">{lang}</span>
                                <span className="text-text-main font-mono">{count} ({percent}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${percent}%` }}
                                  className="h-full rounded-full bg-emerald-400"
                                />
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* AI Generator Breakdown */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    AI Platform Sources
                  </h3>
                  <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
                    {!insights.generators || Object.keys(insights.generators).length === 0 ? (
                      <p className="text-xs text-text-muted font-mono">No generator data available</p>
                    ) : (
                      Object.entries(insights.generators)
                        .sort((a, b) => b[1] - a[1])
                        .map(([gen, count]) => {
                          const percent = insights.stats.total_repos > 0 
                            ? Math.round((count / insights.stats.total_repos) * 100) 
                            : 0;
                          return (
                            <div key={gen} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-text-sub font-mono">{gen}</span>
                                <span className="text-text-main font-mono">{count} ({percent}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${percent}%` }}
                                  className="h-full rounded-full bg-indigo-500"
                                />
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Package Status Breakdown */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <Package size={16} className="text-emerald-400" />
                    Dependency Package Scans
                  </h3>
                  <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
                    {!insights.package_status || Object.keys(insights.package_status).length === 0 ? (
                      <p className="text-xs text-text-muted font-mono">No dependency scan records</p>
                    ) : (
                      Object.entries(insights.package_status)
                        .sort((a, b) => b[1] - a[1])
                        .map(([status, count]) => {
                          const percent = insights.stats.total_packages > 0 
                            ? Math.round((count / insights.stats.total_packages) * 100) 
                            : 0;
                          return (
                            <div key={status} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-text-sub font-mono capitalize">{status}</span>
                                <span className="text-text-main font-mono">{count} ({percent}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${percent}%` }}
                                  className={`h-full rounded-full ${
                                    status === "dangerous" ? "bg-rose-500" :
                                    status === "suspect" ? "bg-amber-400" :
                                    status === "safe" ? "bg-emerald-400" : "bg-slate-400"
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Row 1: Low Health Repos & Common Vulnerabilities */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Vulnerable Repos */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5 lg:col-span-2">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <AlertOctagon size={18} className="text-rose-500 animate-pulse" />
                    Highest Risk Repositories
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-text-muted font-mono text-[9px] uppercase tracking-wider">
                          <th className="pb-3 pr-4 font-bold">Repository</th>
                          <th className="pb-3 px-4 font-bold text-center">Health Score</th>
                          <th className="pb-3 px-4 font-bold text-center">Severities</th>
                          <th className="pb-3 pl-4 font-bold text-right">Owner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-text-sub font-medium">
                        {!insights.top_vulnerable_repos || insights.top_vulnerable_repos.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-text-muted font-mono">
                              No repositories with warnings or all at 100% health
                            </td>
                          </tr>
                        ) : (
                          insights.top_vulnerable_repos.map((repo) => (
                            <tr key={repo.id} className="hover:bg-white/5 transition-all">
                              <td className="py-3.5 pr-4 font-semibold text-text-main truncate max-w-[200px]">
                                {repo.repo_name}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                                  repo.health_score >= 80 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                  repo.health_score >= 60 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                  "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}>
                                  {repo.health_score} / 100
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex gap-1.5 justify-center items-center font-mono text-[9px]">
                                  <span className="px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-900/40 font-bold" title="Critical counts">
                                    C: {repo.critical_count}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/40 font-bold" title="High counts">
                                    H: {repo.high_count}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 pl-4 text-right">
                                <div className="flex flex-col">
                                  <span className="text-text-main font-semibold">{repo.user_name}</span>
                                  <span className="text-[9px] text-text-muted font-mono">{repo.user_email}</span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Common vulnerabilities list */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <Shield size={16} className="text-indigo-400" />
                    Common Vulnerability Types
                  </h3>
                  <div className="space-y-3.5 pt-2 max-h-[350px] overflow-y-auto pr-1">
                    {!insights.common_vulnerabilities || insights.common_vulnerabilities.length === 0 ? (
                      <p className="text-xs text-text-muted font-mono">No vulnerabilities detected yet</p>
                    ) : (
                      insights.common_vulnerabilities.map((vuln, index) => (
                        <div key={index} className="space-y-1 bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className="flex justify-between text-xs font-semibold items-start gap-3">
                            <span className="text-text-main font-semibold text-xs leading-tight">{vuln.title}</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono shrink-0">
                              {vuln.count} matches
                            </span>
                          </div>
                          <p className="text-[9px] text-text-muted font-mono truncate leading-none mt-1">
                            {vuln.rule_id}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Slopsquatting Warnings (Dependency Squatting / Low Adoption Package Alerts) */}
              <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-400 animate-pulse" />
                    Dependency Squatting / Hallucinated Package Alerts
                  </h3>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 self-start">
                    {insights.stats.dangerous_packages_count} Warnings Active
                  </span>
                </div>
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-text-muted font-mono text-[9px] uppercase tracking-wider">
                        <th className="pb-3 pr-4 font-bold">Package Name</th>
                        <th className="pb-3 px-4 font-bold text-center">Manager</th>
                        <th className="pb-3 px-4 font-bold text-center">Risk Level</th>
                        <th className="pb-3 px-4 font-bold">Repository Connection</th>
                        <th className="pb-3 pl-4 font-bold">Registry Analysis Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-text-sub font-medium">
                      {!insights.dangerous_packages || insights.dangerous_packages.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-text-muted font-mono">
                            No suspicious or hallucinated packages flagged. Excellent package supply chain integrity!
                          </td>
                        </tr>
                      ) : (
                        insights.dangerous_packages.map((pkg) => (
                          <tr key={pkg.id} className="hover:bg-white/5 transition-all">
                            <td className="py-3.5 pr-4 font-mono font-bold text-text-main text-xs truncate max-w-[150px]">
                              {pkg.package_name}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono uppercase text-[10px]">
                              {pkg.package_manager}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.5px] border ${
                                pkg.status === "dangerous" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                pkg.status === "suspect" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-slate-500/10 text-slate-400 border-slate-500/20"
                              }`}>
                                {pkg.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold truncate max-w-[200px]">
                              {pkg.repo_name}
                            </td>
                            <td className="py-3.5 pl-4 text-text-sub text-[11px] leading-relaxed max-w-[300px]">
                              {pkg.reason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6">
              {/* Row 1: Recent Users & Recent Scan Log Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Users */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <UserPlus size={16} className="text-emerald-400" />
                    Recent Registrations
                  </h3>
                  <div className="space-y-3.5 pt-2 max-h-[450px] overflow-y-auto pr-1">
                    {!insights.recent_users || insights.recent_users.length === 0 ? (
                      <p className="text-xs text-text-muted font-mono">No users registered yet</p>
                    ) : (
                      insights.recent_users.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-semibold text-text-main">{u.name}</h4>
                            <p className="text-[10px] text-text-muted font-mono truncate max-w-[170px]">{u.email}</p>
                            <div className="flex items-center gap-1.5 pt-1 text-[9px] text-text-muted">
                              <Calendar size={10} />
                              <span>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "Unknown"}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold capitalize font-mono ${
                            u.plan === "enterprise" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            u.plan === "team" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                            u.plan === "pro" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                            "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                          }`}>
                            {u.plan}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Scan Logs */}
                <div className="glass-card p-6 rounded-2xl space-y-4 bg-white/5 border border-white/5 lg:col-span-2">
                  <h3 className="font-display font-bold text-base text-text-main flex items-center gap-2">
                    <Terminal size={16} className="text-indigo-400" />
                    Recent Scan Activities
                  </h3>
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-text-muted font-mono text-[9px] uppercase tracking-wider">
                          <th className="pb-3 pr-4 font-bold">Repository</th>
                          <th className="pb-3 px-4 font-bold">Triggered At</th>
                          <th className="pb-3 px-4 font-bold text-center">Status</th>
                          <th className="pb-3 pl-4 font-bold text-right">Findings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-text-sub font-medium">
                        {insights.recent_scans.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-text-muted font-mono">
                              No scans performed yet
                            </td>
                          </tr>
                        ) : (
                          insights.recent_scans.map((scan) => {
                            const dateStr = scan.triggered_at 
                              ? new Date(scan.triggered_at).toLocaleString() 
                              : "Unknown time";
                            return (
                              <tr key={scan.id} className="hover:bg-white/5 transition-all">
                                <td className="py-3 pr-4 font-semibold text-text-main truncate max-w-[200px]">
                                  {scan.repo_name}
                                </td>
                                <td className="py-3 px-4 text-text-muted text-[10px] font-mono">
                                  {dateStr}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center justify-center">
                                    <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.5px] border ${
                                      scan.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                      scan.status === "failed" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                      scan.status === "running" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse" :
                                      "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                    }`}>
                                      {scan.status}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 pl-4 text-right font-mono font-bold text-text-main">
                                  {scan.findings_count}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

