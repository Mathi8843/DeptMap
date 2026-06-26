"use client";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { apiFetch } from "@/lib/api";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState("Authenticating you with GitHub...");
  const [error, setError] = useState<string | null>(null);
  const exchangeAttempted = useRef(false);

  useEffect(() => { document.title = "Authenticating — Risk Guard AI"; }, []);

  useEffect(() => {
    if (exchangeAttempted.current) return;
    exchangeAttempted.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];

    function setStatusAfter(ms: number) {
      timers.push(setTimeout(() => {
        setStatus("Authentication successful! Redirecting...");
      }, ms));
    }

    function redirectAfter(ms: number, isAdmin: boolean) {
      timers.push(setTimeout(() => {
        const redirectPath = sessionStorage.getItem("auth_redirect") ||
          (isAdmin ? "/admin" : "/onboarding");
        sessionStorage.removeItem("auth_redirect");
        router.push(redirectPath);
      }, ms));
    }

    const authSuccess = searchParams.get("auth") === "success";

    // 1. Production Cookie Session Redirect Flow
    if (authSuccess) {
      const fetchProfileAndLogin = async () => {
        try {
          setStatus("Restoring session profile...");
          const profile = await apiFetch("/auth/me");

          const userData = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            plan: profile.plan,
            session_token: "cookie-session",
            has_github_token: profile.has_github_token,
            is_admin: profile.is_admin,
          };

          login(userData);
          setStatusAfter(0);
          redirectAfter(1000, profile.is_admin);
        } catch (err: any) {
          console.error("Failed to fetch profile on auth success:", err);
          setError("Failed to fetch user profile after authentication. Please try signing in again.");
        }
      };
      fetchProfileAndLogin();
      return () => timers.forEach(clearTimeout);
    }

    const userId = searchParams.get("user_id");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const avatarUrl = searchParams.get("avatar_url");
    const plan = searchParams.get("plan");
    const sessionToken = searchParams.get("session_token");
    const hasGithubToken = searchParams.get("has_github_token") === "true";
    const isAdmin = searchParams.get("is_admin") === "true";

    // 2. Query Params Flow (Development fallback)
    if (userId && email) {
      const userData = {
        id: userId,
        name: name || "User",
        email: email,
        avatar_url: avatarUrl || null,
        plan: (plan || "free") as any,
        session_token: sessionToken || undefined,
        has_github_token: hasGithubToken,
        is_admin: isAdmin,
      };

      login(userData);
      setStatusAfter(0);
      redirectAfter(1000, isAdmin);
      return () => timers.forEach(clearTimeout);
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state") || "";
    const oauthError = searchParams.get("error");

    // User cancelled GitHub OAuth — send them back to home cleanly
    if (oauthError) {
      router.replace("/?cancelled=1");
      return;
    }

    if (!code) {
      setError("No authorization code found from GitHub. Please try signing in again.");
      return;
    }

    // 3. Frontend Exchange Code Flow
    const exchangeCode = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/auth/github/callback?code=${code}&state=${encodeURIComponent(state)}`);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || "Authentication callback failed");
        }

        const data = await response.json();

        const userData = {
          id: data.user_id,
          name: data.name,
          email: data.email,
          avatar_url: data.avatar_url,
          plan: data.plan,
          session_token: data.session_token,
          has_github_token: true,
          is_admin: data.is_admin,
        };

        login(userData);
        setStatusAfter(0);
        redirectAfter(1000, data.is_admin);
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Something went wrong during GitHub authorization. Please try again.");
      }
    };

    exchangeCode();
    return () => timers.forEach(clearTimeout);
  }, [searchParams, router, login]);

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center space-y-6 shadow-2xl">
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Shield size={24} className={error ? "text-rose-400" : "animate-pulse"} />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold tracking-tight text-text-main">
        {error ? "Authentication Error" : "Connecting Accounts"}
      </h1>

      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-rose-400/90 leading-relaxed bg-rose-500/5 border border-rose-500/10 rounded-xl p-4">
            {error}
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-bg-card border border-border-subtle hover:bg-border-glow text-text-main rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-sub">{status}</p>
          <div className="flex justify-center pt-2">
            <Loader2 className="text-indigo-400 animate-spin" size={20} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  const { theme } = useTheme();
  const background = theme === "dark"
    ? "radial-gradient(ellipse at 50% 30%, #15102a 0%, #06060c 60%)"
    : "radial-gradient(ellipse at 50% 30%, #c7d2fe 0%, #e2e8f0 35%, #f1f5f9 100%)";

  return (
    <div 
      style={{ background }}
      className="min-h-screen text-text-main flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <Suspense fallback={
        <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center space-y-6 shadow-2xl flex flex-col items-center justify-center min-h-[200px]">
          <Loader2 className="text-indigo-400 animate-spin" size={28} />
        </div>
      }>
        <AuthCallbackInner />
      </Suspense>
    </div>
  );
}
