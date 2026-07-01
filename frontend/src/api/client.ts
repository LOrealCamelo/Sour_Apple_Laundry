import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";
const TOKEN_KEY = "sa_token";

export async function getToken(): Promise<string | null> {
  return await storage.secureGet(TOKEN_KEY, null);
}
export async function setToken(t: string) {
  await storage.secureSet(TOKEN_KEY, t);
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

type Options = { method?: string; body?: any; auth?: boolean };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = "Bearer " + t;
  }
  const res = await fetch(BASE + path, {
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
