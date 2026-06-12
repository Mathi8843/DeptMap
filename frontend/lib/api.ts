/**
 * API Client helper for DebtMap Next.js frontend.
 */

export interface SavedUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  plan: "free" | "pro" | "team" | "enterprise";
  github_access_token?: string;
}

export function getSavedUser(): SavedUser | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("debtmap_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
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
 * Fetch wrapper that automatically adds the logged-in user_id as a query param.
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const user = getSavedUser();
  // If not logged in, we use a fallback ID for local testing/demo purposes
  const userId = user?.id || "00000000-0000-0000-0000-000000000000"; 

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  // Format the path: ensure it starts with /api
  let apiPath = path;
  if (!apiPath.startsWith("/api") && !apiPath.startsWith("api")) {
    apiPath = apiPath.startsWith("/") ? `/api${apiPath}` : `/api/${apiPath}`;
  }

  // Construct URL and append user_id query param
  const url = new URL(apiPath, apiUrl);
  if (!url.searchParams.has("user_id")) {
    url.searchParams.set("user_id", userId);
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Accept": "application/json",
      ...options.headers,
    },
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
