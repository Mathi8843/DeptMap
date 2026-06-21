"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Users, GitBranch, Terminal, ShieldAlert, 
  RefreshCw, Lock, AlertTriangle, CheckCircle, XCircle 
} from "lucide-react";

interface AdminInsights {
  stats: {
    total_users: number;
    total_repos: number;
    total_scans: number;
    total_issues: number;
  };
  plans: {
    free: number;
    pro: number;
    team: number;
    enterprise: number;
  };
  languages: Record<string, number>;
  scan_status: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  recent_scans: Array<{
    id: string;
    repo_name: string;
    status: string;
    findings_count: number;
    triggered_at: string;
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
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Guard check for admin credentials
  const isAdmin = user.is_admin;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <Lock size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display font-extrabold text-2xl text-text-main">Access Denied</h1>
          <p className="text-sm text-text-muted leading-relaxed">
            You do not have administrative permissions to view this dashboard. Access is restricted to authorized credentials.
          </p>
        </div>
        <div className="text-xs text-text-muted bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl">
          Logged in as: <span className="font-mono text-slate-300 font-bold">{user.email || "No Email"}</span>
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            Admin Metrics
          </h1>
          <p className="text-sm text-text-sub">
            System overview, user licenses, and scan health insights
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
          <span className="font-mono text-xs uppercase tracking-widest">Compiling admin insights...</span>
        </div>
      ) : insights ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">Total Registrants</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_users}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <GitBranch size={22} />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">Repos Connected</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_repos}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Terminal size={22} />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">Total Scans Run</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_scans}
                </h3>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert size={22} />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">Issues Detected</p>
                <h3 className="font-display font-extrabold text-2xl text-text-main mt-0.5">
                  {insights.stats.total_issues}
                </h3>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Plan Breakdown */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-base text-text-main">
                User Subscriptions
              </h3>
              <div className="space-y-3 pt-2">
                {Object.entries(insights.plans).map(([plan, count]) => {
                  const percent = insights.stats.total_users > 0 
                    ? Math.round((count / insights.stats.total_users) * 100) 
                    : 0;
                  return (
                    <div key={plan} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="capitalize text-text-sub">{plan}</span>
                        <span className="text-text-main">{count} ({percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            plan === "enterprise" ? "bg-amber-500" :
                            plan === "team" ? "bg-purple-500" :
                            plan === "pro" ? "bg-indigo-500" : "bg-slate-500"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scan Status Breakdown */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-base text-text-main">
                Scan Process Engine Health
              </h3>
              <div className="space-y-3 pt-2">
                {Object.entries(insights.scan_status).map(([status, count]) => {
                  const percent = insights.stats.total_scans > 0 
                    ? Math.round((count / insights.stats.total_scans) * 100) 
                    : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="capitalize text-text-sub">{status}</span>
                        <span className="text-text-main">{count} ({percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            status === "completed" ? "bg-emerald-500" :
                            status === "failed" ? "bg-rose-500" :
                            status === "running" ? "bg-indigo-500" : "bg-slate-500"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Severity Distribution */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-base text-text-main">
                Exposures Severity Scale
              </h3>
              <div className="space-y-3 pt-2">
                {Object.entries(insights.issue_severity).map(([severity, count]) => {
                  const percent = insights.stats.total_issues > 0 
                    ? Math.round((count / insights.stats.total_issues) * 100) 
                    : 0;
                  return (
                    <div key={severity} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="capitalize text-text-sub">{severity}</span>
                        <span className="text-text-main">{count} ({percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            severity === "critical" ? "bg-rose-600" :
                            severity === "high" ? "bg-rose-500" :
                            severity === "medium" ? "bg-amber-500" : "bg-indigo-500"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Languages & Recent Scans */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Connected languages */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-base text-text-main">
                Top Code Languages
              </h3>
              <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto">
                {Object.keys(insights.languages).length === 0 ? (
                  <p className="text-xs text-text-muted">No language data available</p>
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
                            <span className="text-text-main">{count} ({percent}%)</span>
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

            {/* Recent Scans activity */}
            <div className="glass-card p-6 rounded-2xl space-y-4 lg:col-span-2">
              <h3 className="font-display font-bold text-base text-text-main">
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
                        <td colSpan={4} className="py-4 text-center text-text-muted">
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
        </>
      ) : null}
    </div>
  );
}
