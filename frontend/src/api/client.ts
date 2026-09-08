// src/api/client.ts - Universal Web API Client (Zero Expo)

// In Vite/Web, environment variables use import.meta.env
// Replace the fallback URL below with your actual Render URL!
const BASE = (
  import.meta.env.VITE_API_URL || "https://sour-apple-api.onrender.com/api"
).replace(/\/$/, "");

const TOKEN_KEY = "sa_token";

export async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function setToken(t: string): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, t);
  }
}

export async function clearToken(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

type Options = { method?: string; body?: any; auth?: boolean };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = "Bearer " + t;
  }

  // Ensure path starts with a slash
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(BASE + cleanPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error((data && data.detail) || "Request failed");
  }

  return data as T;
}
