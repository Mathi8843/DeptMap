/**
 * API Client helper for DebtMap Next.js frontend.
 */

export interface SavedUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  plan: "free" | "pro" | "team" | "enterprise";
  /** Held in memory only — never written to localStorage. */
  session_token?: string;
  has_github_token?: boolean;
  is_admin?: boolean;
}

/**
 * Profile data that is safe to persist in localStorage.
 * session_token is intentionally excluded — it stays in memory only.
 * The backend sets an httpOnly cookie (debtmap_session) for persistence
 * across page refreshes. Storing the JWT in localStorage exposes it to XSS.
 */
export type PersistedProfile = Omit<SavedUser, "session_token">;

export function getSavedUser(): PersistedProfile | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("debtmap_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/** Persist only non-sensitive profile fields — never the session token. */
export function saveUser(user: SavedUser) {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { session_token: _drop, ...profile } = user;
    localStorage.setItem("debtmap_user", JSON.stringify(profile));
  }
}

export function logoutUser() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("debtmap_user");
  }
}

/**
 * Fetch wrapper that automatically adds the session JWT to the Authorization header.
 */
const API_TIMEOUT = 120_000; // 120 seconds (2 minutes) for scans, PRs, and LLM processing

export async function apiFetch(path: string, options: RequestInit = {}) {
  // session_token is no longer in localStorage — the httpOnly cookie
  // (debtmap_session) is sent automatically via credentials:"include".
  // For backward-compat with dev flows that pass a JWT via Authorization,
  // callers may supply it via options.headers directly.

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  // Format the path: ensure it starts with /api
  let apiPath = path;
  if (!apiPath.startsWith("/api") && !apiPath.startsWith("api")) {
    apiPath = apiPath.startsWith("/") ? `/api${apiPath}` : `/api/${apiPath}`;
  }

  // Construct URL
  const url = new URL(apiPath, apiUrl);

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url.toString(), {
      ...options,
      signal: options.signal || controller.signal,
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = "API call failed";
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = errorText || errorDetail;
      }
      throw new Error(errorDetail);
    }

    return response.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
