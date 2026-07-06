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

// ─── In-memory session token store ───────────────────────────────────────────
// The JWT lives here in JS heap memory — NOT in localStorage.
// This is intentional: localStorage is readable by any injected XSS script,
// whereas a plain JS variable is not accessible cross-origin.
// AuthContext calls setInMemoryToken() whenever auth state changes.
let _inMemoryToken: string | undefined;

export function setInMemoryToken(token: string | undefined) {
  _inMemoryToken = token;
}

export function getInMemoryToken(): string | undefined {
  return _inMemoryToken;
}
// ─────────────────────────────────────────────────────────────────────────────

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
    _inMemoryToken = undefined;
  }
}

/**
 * Fetch wrapper that automatically authenticates requests.
 *
 * Auth strategy (in priority order):
 *  1. If there is an in-memory JWT (email login), send it as Authorization: Bearer.
 *  2. Otherwise, rely on the httpOnly debtmap_session cookie (GitHub OAuth login)
 *     which is sent automatically via credentials:"include".
 *  3. Fall back to mock-session-token for local development if neither is present.
 */
const API_TIMEOUT = 120_000; // 120 seconds — covers scans, PRs, LLM processing

export async function apiFetch(path: string, options: RequestInit = {}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Format the path: ensure it starts with /api
  let apiPath = path;
  if (!apiPath.startsWith("/api") && !apiPath.startsWith("api")) {
    apiPath = apiPath.startsWith("/") ? `/api${apiPath}` : `/api/${apiPath}`;
  }

  const url = new URL(apiPath, apiUrl);

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Send the JWT as a Bearer token when available (email/password login).
  // GitHub OAuth login uses the httpOnly cookie instead (sent via credentials:"include").
  // "cookie-session" and "mock-session-token" are sentinel values — not real JWTs.
  const token = _inMemoryToken;
  const isRealJwt =
    token &&
    token !== "cookie-session" &&
    token !== "mock-session-token";

  if (isRealJwt) {
    headers["Authorization"] = `Bearer ${token}`;
  }

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
