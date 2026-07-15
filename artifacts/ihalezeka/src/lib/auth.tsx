import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false as const, message: data.message ?? "Giriş başarısız." };
      }
      const me = await res.json();
      setUser(me);
      queryClient.invalidateQueries();
      return { ok: true as const };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false as const, message: data.message ?? "Kayıt başarısız." };
      }
      const me = await res.json();
      setUser(me);
      queryClient.invalidateQueries();
      return { ok: true as const };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    queryClient.invalidateQueries();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoaded, isSignedIn: !!user, signIn, signUp, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
