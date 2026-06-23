"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { X, GitBranch, Shield, Globe, Terminal, Loader2, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectRepoModal({ isOpen, onClose }: ConnectRepoModalProps) {
  const { user } = useAuth();
  const { repos, connectRepo } = useData();
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [generator, setGenerator] = useState("Lovable");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync selected repository default branch to the branch input field
  useEffect(() => {
    if (selectedRepo && githubRepos.length > 0) {
      const repoInfo = githubRepos.find((r) => r.full_name === selectedRepo);
      if (repoInfo && repoInfo.default_branch) {
        setBranch(repoInfo.default_branch);
      }
    }
  }, [selectedRepo, githubRepos]);

  // Keep a stable ref for connected repo names so the effect doesn't re-run
  // every time the repos array reference changes in context (avoids infinite loop).
  const connectedNamesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isOpen || !user.has_github_token) return;
    // Snapshot the currently connected names at the moment the modal opens.
    connectedNamesRef.current = repos.map((r) => r.full_name);
    const fetchRepos = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiFetch("/repos/github-list");
        setGithubRepos(list || []);

        // Pre-select first unconnected repo using the stable ref (no dep needed)
        if (list && list.length > 0) {
          const available = list.filter(
            (r: any) => !connectedNamesRef.current.includes(r.full_name)
          );
          if (available.length > 0) {
            setSelectedRepo(available[0].full_name);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load repositories from GitHub.");
      } finally {
        setLoading(false);
      }
    };
    fetchRepos();
    // Only re-run when the modal is opened or the github token status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user.has_github_token]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConnectGitHub = async () => {
    try {
      const data = await apiFetch(`/auth/github?current_user_id=${user.id}`);
      if (data && data.auth_url) {
        sessionStorage.setItem("auth_redirect", "/dashboard");
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      alert(err.message || "Failed to retrieve GitHub connection link.");
    }
  };

  const connectedNames = repos.map((r) => r.full_name);
  const availableRepos = githubRepos.filter((r) => !connectedNames.includes(r.full_name));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) {
      alert("Please select a repository to connect.");
      return;
    }
    const repoInfo = githubRepos.find((r) => r.full_name === selectedRepo);
    connectRepo(
      selectedRepo,
      repoInfo?.language || language,
      generator,
      repoInfo?.is_private ?? true,
      branch || repoInfo?.default_branch || "main"
    );
    onClose();
    setSelectedRepo("");
    setBranch("");
  };

  // Find info of the currently selected repo in dropdown
  const selectedRepoInfo = githubRepos.find((r) => r.full_name === selectedRepo);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div role="dialog" aria-modal="true" aria-label="Connect repository" className="relative w-full max-w-md glass-card rounded-2xl p-6 border border-border-subtle shadow-2xl z-10 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <GitBranch size={16} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-base text-text-main">Connect Repository</h2>
              <p className="text-[10px] text-text-muted mt-0.5">Link a GitHub workspace for vulnerability auditing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Not Connected State */}
        {!user.has_github_token && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400">
              <GitBranch size={22} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-text-main">GitHub Account Not Connected</h3>
              <p className="text-xs text-text-sub max-w-xs mx-auto leading-relaxed">
                You must connect your GitHub account to fetch and import repositories.
              </p>
            </div>
            <button
              onClick={handleConnectGitHub}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg"
            >
              Connect GitHub Account
            </button>
          </div>
        )}

        {/* Connected State Form */}
        {user.has_github_token && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Repository Select */}
            <div>
              <label htmlFor="repo-select" className="block font-mono text-[9px] uppercase tracking-[1.5px] text-text-muted mb-1.5">
                Select Repository
              </label>
              
              {loading && (
                <div className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 flex items-center gap-2.5 justify-center">
                  <Loader2 className="animate-spin text-indigo-400" size={16} />
                  <span className="text-xs text-text-sub font-mono">Fetching repos from GitHub...</span>
                </div>
              )}

              {error && (
                <div className="w-full bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-400 leading-normal">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div>{error}</div>
                    <button 
                      type="button" 
                      onClick={handleConnectGitHub}
                      className="underline font-bold mt-1 text-[10px] block"
                    >
                      Re-authorize GitHub
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && availableRepos.length === 0 && (
                <div className="w-full bg-bg-deep border border-border-subtle rounded-xl p-4 text-center text-xs text-text-muted font-mono leading-relaxed">
                  All repositories on your GitHub account are already connected!
                </div>
              )}

              {!loading && !error && availableRepos.length > 0 && (
                <select
                  id="repo-select"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors cursor-pointer"
                >
                  {availableRepos.map((r) => (
                    <option key={r.full_name} value={r.full_name} className="bg-bg-panel text-text-main">
                      {r.full_name} ({r.is_private ? "Private" : "Public"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Target Branch to Scan */}
            {selectedRepo && (
              <div>
                <label htmlFor="branch-input" className="block font-mono text-[9px] uppercase tracking-[1.5px] text-text-muted mb-1.5">
                  Scan Branch
                </label>
                <input
                  id="branch-input"
                  type="text"
                  placeholder="e.g. main, master, development"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors"
                  required
                />
              </div>
            )}

            {/* AI Generator Tool */}
            <div>
              <label htmlFor="generator-select" className="block font-mono text-[9px] uppercase tracking-[1.5px] text-text-muted mb-1.5">
                AI Coding Tool used to build this
              </label>
              <select
                id="generator-select"
                value={generator}
                onChange={(e) => setGenerator(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors cursor-pointer"
              >
                {["Lovable", "Cursor", "Bolt", "v0", "Replit", "GitHub Copilot", "None"].map((g) => (
                  <option key={g} value={g} className="bg-bg-panel text-text-main">{g}</option>
                ))}
              </select>
            </div>

            {/* Repo Privacy Details Indicator */}
            {selectedRepoInfo && (
              <div className="flex items-center justify-between p-3.5 bg-bg-deep border border-border-subtle rounded-xl font-sans text-xs">
                <div className="flex items-center gap-2.5">
                  {selectedRepoInfo.is_private ? (
                    <Shield size={14} className="text-indigo-400" />
                  ) : (
                    <Globe size={14} className="text-emerald-400" />
                  )}
                  <div>
                    <div className="font-semibold text-text-main">
                      {selectedRepoInfo.is_private ? "Private Repository" : "Public Repository"}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      Detected language: {selectedRepoInfo.language || "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || availableRepos.length === 0}
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Terminal size={12} />
              Connect & Run Audit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
