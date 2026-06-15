"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Authenticating you with GitHub...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = searchParams.get("user_id");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const avatarUrl = searchParams.get("avatar_url");
    const plan = searchParams.get("plan");
    const sessionToken = searchParams.get("session_token");
    const hasGithubToken = searchParams.get("has_github_token") === "true";

    if (userId && email) {
      // Save user profile to localStorage directly
      localStorage.setItem("debtmap_user", JSON.stringify({
        id: userId,
        name: name || "User",
        email: email,
        avatar_url: avatarUrl || null,
        plan: plan || "free",
        session_token: sessionToken || undefined,
        has_github_token: hasGithubToken
      }));

      setTimeout(() => {
        setStatus("Authentication successful! Redirecting to onboarding...");
      }, 0);
      
      const timer = setTimeout(() => {
        router.push("/onboarding");
      }, 1000);
      return () => clearTimeout(timer);
    }

    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code found from GitHub. Please try signing in again.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/auth/github/callback?code=${code}`);
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || "Authentication callback failed");
        }

        const data = await response.json();
        
        // Save user profile to localStorage
        localStorage.setItem("debtmap_user", JSON.stringify({
          id: data.user_id,
          name: data.name,
          email: data.email,
          avatar_url: data.avatar_url,
          plan: data.plan,
          session_token: data.session_token,
          has_github_token: true
        }));

        setTimeout(() => {
          setStatus("Authentication successful! Redirecting to onboarding...");
        }, 0);
        
        // Brief delay for premium user feel
        const timer = setTimeout(() => {
          router.push("/onboarding");
        }, 1000);
        return () => clearTimeout(timer);

      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Something went wrong during GitHub authorization. Please try again.");
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="w-full max-w-md bg-[#0d0d1a] border border-white/5 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Shield size={24} className={error ? "text-rose-400" : "animate-pulse"} />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold tracking-tight">
        {error ? "Authentication Error" : "Connecting Accounts"}
      </h1>

      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-rose-400/90 leading-relaxed bg-rose-500/5 border border-rose-500/10 rounded-xl p-4">
            {error}
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#8888bb]">{status}</p>
          <div className="flex justify-center pt-2">
            <Loader2 className="text-indigo-400 animate-spin" size={20} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div 
      style={{ background: "radial-gradient(circle at 50% 30%, #15102a 0%, #06060c 60%)" }}
      className="min-h-screen text-[#eeeeff] flex flex-col items-center justify-center p-6"
    >
      <Suspense fallback={
        <div className="w-full max-w-md bg-[#0d0d1a] border border-white/5 rounded-2xl p-8 text-center space-y-6 shadow-2xl flex flex-col items-center justify-center min-h-[200px]">
          <Loader2 className="text-indigo-400 animate-spin" size={28} />
        </div>
      }>
        <AuthCallbackInner />
      </Suspense>
    </div>
  );
}
