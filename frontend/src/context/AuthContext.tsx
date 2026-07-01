import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, clearToken, getToken } from "@/src/api/client";

export type User = {
  id: string; name: string; email: string; role: string;
  phone: string; campus: string; building: string; room: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: any) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        try {
          const me = await api<User>("/auth/me");
          setUser(me);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST", body: { email, password }, auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (payload: any) => {
    const res = await api<{ access_token: string; user: User }>("/auth/register", {
      method: "POST", body: payload, auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api<User>("/auth/me");
    setUser(me);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}
