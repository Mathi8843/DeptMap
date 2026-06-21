"use client";
import React, { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isInitializing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Redirect if there's no session token after initial session check completes
    if (!isInitializing && !user.session_token) {
      router.replace("/");
    }
  }, [user.session_token, isInitializing, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Show loading indicator if still initializing or if not authenticated yet to prevent UI flash
  if (isInitializing || !user.session_token) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#06060c] text-[#8888bb]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest">Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[--bg] overflow-hidden">
      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed bottom-6 left-4 z-50 w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 hover:bg-indigo-600 transition-all"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - static on desktop, fixed overlay on mobile */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out`}
      >
        <Sidebar />
      </div>

      <main className="flex-1 overflow-y-auto pb-14 md:pb-0">
        {children}
      </main>
    </div>
  );
}
