"use client";
import React, { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { X, GitBranch, Shield, Globe, Terminal } from "lucide-react";

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectRepoModal({ isOpen, onClose }: ConnectRepoModalProps) {
  const { connectRepo } = useApp();
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [generator, setGenerator] = useState("Lovable");
  const [isPrivate, setIsPrivate] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !fullName.includes("/")) {
      alert("Please enter a repository name in the format 'username/repo-name'");
      return;
    }
    connectRepo(fullName, language, generator, isPrivate);
    onClose();
    // reset form
    setFullName("");
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 shadow-2xl z-10 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <GitBranch size={16} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-base text-white">Connect Repository</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Link a GitHub workspace for vulnerability auditing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repository Name */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[1.5px] text-slate-400 mb-1.5">
              GitHub Repo Path
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. mathivanan/saas-app"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Grid fields */}
          <div className="grid grid-cols-2 gap-3">
            {/* Primary Language */}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                Main Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
              >
                {["TypeScript", "Python", "JavaScript", "Go", "Rust", "Ruby", "HTML/CSS"].map((l) => (
                  <option key={l} value={l} className="bg-slate-950 text-white">{l}</option>
                ))}
              </select>
            </div>

            {/* AI Generator Tool */}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                AI Coding Tool
              </label>
              <select
                value={generator}
                onChange={(e) => setGenerator(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
              >
                {["Lovable", "Cursor", "Bolt", "v0", "Replit", "GitHub Copilot", "None"].map((g) => (
                  <option key={g} value={g} className="bg-slate-950 text-white">{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-white/5 rounded-xl">
            <div className="flex items-center gap-2.5">
              {isPrivate ? (
                <Shield size={14} className="text-indigo-400" />
              ) : (
                <Globe size={14} className="text-emerald-400" />
              )}
              <div>
                <div className="text-xs font-semibold text-white">Private Repository</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Restrict access to authenticated users</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                isPrivate ? "bg-indigo-500" : "bg-slate-800"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  isPrivate ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98]"
          >
            <Terminal size={12} />
            Connect & Run Audit
          </button>
        </form>
      </div>
    </div>
  );
}
