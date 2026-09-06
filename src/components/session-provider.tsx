"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getConnection, setConnection } from "@/lib/jellyfin-connection";
import { browserSignIn } from "@/lib/jellyfin-browser";

export type SessionInfo = {
  signedIn: boolean;
  userName?: string;
  userId?: string;
  serverUrl?: string;
};

type SessionContextValue = {
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  preview: boolean;
  enterPreview: () => void;
  signIn: (input: {
    serverUrl: string;
    username: string;
    password: string;
    allowInsecure?: boolean;
    cfAccessClientId?: string;
    cfAccessClientSecret?: string;
    cfAccessJwt?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("cinema-preview") === "1";
  });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const data = (await response.json()) as SessionInfo;
    setSession(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json() as Promise<SessionInfo>)
      .then((data) => {
        if (cancelled) return;
        const stored = getConnection();
        if (stored) {
          setSession({
            signedIn: true,
            userName: stored.userName,
            userId: stored.userId,
            serverUrl: stored.serverUrl,
          });
          return;
        }
        setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession({ signedIn: false });
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const signIn = useCallback(
    async (input: {
      serverUrl: string;
      username: string;
      password: string;
      allowInsecure?: boolean;
      cfAccessClientId?: string;
      cfAccessClientSecret?: string;
      cfAccessJwt?: string;
    }) => {
      setError(null);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as SessionInfo & { error?: string };
      if (response.ok) {
        setConnection(null);
        window.sessionStorage.removeItem("cinema-preview");
        setPreview(false);
        setSession({ ...data, signedIn: true });
        return;
      }
      try {
        const direct = await browserSignIn({
          serverUrl: input.serverUrl,
          username: input.username,
          password: input.password,
        });
        setConnection(direct);
        window.sessionStorage.removeItem("cinema-preview");
        setPreview(false);
        setSession({
          signedIn: true,
          userName: direct.userName,
          userId: direct.userId,
          serverUrl: direct.serverUrl,
        });
        return;
      } catch {
        setError(data.error || "Could not sign in.");
        throw new Error(data.error || "Could not sign in.");
      }
    },
    []
  );

  const enterPreview = useCallback(() => {
    window.sessionStorage.setItem("cinema-preview", "1");
    setPreview(true);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.sessionStorage.removeItem("cinema-preview");
    setConnection(null);
    setSession({ signedIn: false });
    setPreview(false);
  }, []);

  const value = useMemo(
    () => ({ session, loading, error, preview, enterPreview, signIn, signOut, refresh }),
    [session, loading, error, preview, enterPreview, signIn, signOut, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
