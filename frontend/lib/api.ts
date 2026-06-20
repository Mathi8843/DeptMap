/**
 * API Client helper for DebtMap Next.js frontend.
 */

export interface SavedUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  plan: "free" | "pro" | "team" | "enterprise";
  session_token?: string;
  has_github_token?: boolean;
  is_admin?: boolean;
}

export function getSavedUser(): SavedUser | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("debtmap_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function saveUser(user: SavedUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem("debtmap_user", JSON.stringify(user));
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
export async function apiFetch(path: string, options: RequestInit = {}) {
  const user = getSavedUser();
  const sessionToken = user?.session_token;

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

  // Only send the Authorization header when we have a real JWT.
  // "cookie-session" means the session lives in an httpOnly cookie that is
  // transmitted automatically via credentials:"include" — do NOT echo it as
  // a Bearer token because the backend will reject it as an invalid JWT.
  const isRealJwt =
    sessionToken &&
    sessionToken !== "cookie-session" &&
    sessionToken !== "mock-session-token";

  if (isRealJwt) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(url.toString(), {
    ...options,
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
}
