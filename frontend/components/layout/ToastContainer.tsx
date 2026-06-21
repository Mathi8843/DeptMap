"use client";
import React from "react";
import { useToast } from "@/lib/contexts/ToastContext";
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const bgMap: Record<string, string> = {
          success: "bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-950/20",
          warning: "bg-amber-950/90 border-amber-500/30 text-amber-300 shadow-amber-950/20",
          error: "bg-rose-950/90 border-rose-500/30 text-rose-300 shadow-rose-950/20",
          info: "bg-blue-950/90 border-blue-500/30 text-blue-300 shadow-blue-950/20",
        };
        const bgStyles = bgMap[toast.type];

        const iconMap: Record<string, typeof CheckCircle> = {
          success: CheckCircle,
          warning: AlertTriangle,
          error: AlertOctagon,
          info: Info,
        };
        const Icon = iconMap[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 animate-slide-up ${bgStyles}`}
          >
            <Icon size={16} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-xs font-sans font-medium leading-relaxed">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
