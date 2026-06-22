"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import ConnectRepoModal from "./ConnectRepoModal";
import {
  LayoutDashboard, AlertTriangle, Package,
  TrendingUp, Shield, GitBranch, Settings, Zap, Plus, Globe, Lock, Sun, Moon, LogOut
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { repos, issues, upgradePlan } = useData();
  const { theme, setTheme } = useTheme();
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const openIssues = issues.filter((i) => i.status === "open");
  const criticalOpen = openIssues.filter((i) => i.severity === "critical").length;

  const getPlanBadgeColor = (p: typeof user.plan) => {
    switch (p) {
      case "free": return "text-text-muted border-border-glow bg-bg-card";
      case "pro": return "text-emerald-600 dark:text-lime-400 border-emerald-500/20 dark:border-lime-500/20 bg-emerald-500/5 dark:bg-lime-500/10";
      case "team": return "text-purple-500 dark:text-purple-400 border-purple-500/20 bg-purple-500/10";
      case "enterprise": return "text-amber-500 dark:text-amber-400 border-amber-500/20 bg-amber-500/10";
    }
  };

  const isAdmin = user.is_admin;

  const navItems = isAdmin 
    ? [
        { label: "System Insights", href: "/admin", icon: LayoutDashboard, section: "admin" }
      ]
    : [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "overview" },
        { 
          label: "Issues", 
          href: "/issues", 
          icon: AlertTriangle, 
          section: "overview", 
          badge: openIssues.length,
          isCriticalBadge: criticalOpen > 0
        },
        { label: "Packages", href: "/packages", icon: Package, section: "overview" },
        { label: "Trend", href: "/trend", icon: TrendingUp, section: "overview" },
        { label: "SOC 2 Report", href: "/soc2", icon: Shield, section: "overview" },
        { label: "Repositories", href: "/repos", icon: GitBranch, section: "manage" },
        { label: "Settings", href: "/settings", icon: Settings, section: "manage" },
      ];

  return (
    <aside className="w-64 flex-shrink-0 bg-bg-panel border-r border-border-subtle flex flex-col h-full overflow-y-auto">
      {/* Brand & Theme Toggle */}
      <div className="p-6 border-b border-border-subtle flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-display font-extrabold text-sm text-white shadow-lg shadow-indigo-500/20">
              D
            </div>
            <span className="font-display font-extrabold text-base text-text-main tracking-wide">
              DebtMap
            </span>
          </div>
          
          {/* Theme switcher */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border-subtle hover:bg-border-subtle text-text-sub hover:text-text-main transition-all cursor-pointer"
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-mono text-[9px] font-bold uppercase tracking-[1.5px] px-3 py-1 rounded-full border ${getPlanBadgeColor(user.plan)}`}>
            {user.plan} account
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 space-y-6">
        {(isAdmin ? (["admin"] as const) : (["overview", "manage"] as const)).map((section) => {
          const items = navItems.filter((i) => i.section === section);
          return (
            <div key={section} className="space-y-1">
              <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-text-muted px-6 mb-2">
                {section}
              </div>
              {items.map((item) => {
                const isActive = pathname === item.href || (pathname?.startsWith(item.href + "/") && item.href !== "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3.5 px-6 py-2.5 text-sm font-semibold tracking-wide transition-all border-l-2 ${
                      isActive
                        ? "text-indigo-500 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500"
                        : "text-text-sub hover:text-text-main border-transparent hover:bg-border-subtle"
                    }`}
                  >
                    <item.icon
                      size={16}
                      className={`transition-colors duration-200 ${
                        isActive ? "text-indigo-500 dark:text-indigo-400" : "text-text-muted group-hover:text-text-main"
                      }`}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        item.isCriticalBadge 
                          ? "bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 animate-pulse" 
                          : "bg-bg-card text-text-sub"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* Repos quick access */}
        {!isAdmin && repos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-6 mb-2">
              <span className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-text-muted">
                Workspaces
              </span>
              <button 
                onClick={() => setConnectModalOpen(true)}
                className="text-text-muted hover:text-indigo-500 transition-colors cursor-pointer"
                title="Connect repository"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="max-h-[160px] overflow-y-auto px-3 space-y-0.5">
              {repos.map((repo) => {
                const name = repo.full_name.split("/")[1];
                const cnt = issues.filter((i) => i.repo_id === repo.id && i.status === "open").length;
                return (
                  <Link
                    key={repo.id}
                    href={`/repos`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-text-sub hover:text-text-main hover:bg-border-subtle transition-all animate-fade-in"
                  >
                    {repo.is_private ? (
                      <Lock size={12} className="text-text-muted flex-shrink-0" />
                    ) : (
                      <Globe size={12} className="text-text-muted flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate font-mono text-[11px]">{name}</span>
                    {cnt > 0 && (
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">
                        {cnt}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User profile footer */}
      <div className="p-5 border-t border-border-subtle space-y-4">
        {user.plan === "free" && !isAdmin && (
          <button
            onClick={() => router.push("/settings?upgrade=pro")}
            className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold tracking-[1px] uppercase py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95"
          >
            <Zap size={11} /> Upgrade to Pro
          </button>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-xs font-bold text-text-main">
              {user.name ? user.name[0] : "?"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-text-main truncate">{user.name || "User"}</div>
              <div className="text-[10px] text-text-muted truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border-subtle hover:bg-rose-500/5 text-text-muted hover:text-rose-500 transition-all cursor-pointer"
            aria-label="Log Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Connect Repo Modal Container */}
      <ConnectRepoModal 
        isOpen={connectModalOpen} 
        onClose={() => setConnectModalOpen(false)} 
      />
    </aside>
  );
}
