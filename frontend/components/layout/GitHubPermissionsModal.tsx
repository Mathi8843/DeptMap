import React from "react";
import { Shield, X, ArrowRight } from "lucide-react";

interface GitHubPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function GitHubPermissionsModal({
  isOpen,
  onClose,
  onConfirm,
}: GitHubPermissionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-md" 
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-label="GitHub Permissions Notice" 
        className="relative w-full max-w-md bg-[#0b0c10] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield size={16} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-base text-white">GitHub Connection Flow</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialogue"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed font-medium font-sans">
            DebtMap requests read-only access to your code. We never write to your repo except when opening fix PRs (which you approve).
          </p>
          <div className="text-[10px] text-slate-500 font-mono">
            Read our <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a> to learn how we secure your data.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-white/10 hover:border-white/20 bg-transparent text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer text-xs font-mono font-bold uppercase tracking-[1px]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-grow-[2] flex items-center justify-center gap-1.5 py-3 bg-[#b8ff57] hover:bg-lime-400 text-slate-950 rounded-xl transition-colors cursor-pointer text-xs font-mono font-bold uppercase tracking-[1px]"
          >
            Agree and Connect <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
