"use client";
import React, { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useApp } from "@/lib/AppContext";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isInitializing } = useApp();
  const router = useRouter();

  useEffect(() => {
    // Redirect if there's no session token after initial session check completes
    if (!isInitializing && !user.session_token) {
      router.replace("/");
    }
  }, [user.session_token, isInitializing, router]);

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
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
