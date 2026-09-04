"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  signIn: (input: { serverUrl: string; username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const data = (await response.json()) as SessionInfo;
    setSession(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<SessionInfo>)
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession({ signedIn: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (input: { serverUrl: string; username: string; password: string }) => {
      setError(null);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as SessionInfo & { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not sign in.");
        throw new Error(data.error || "Could not sign in.");
      }
      setPreview(false);
      setSession({ ...data, signedIn: true });
    },
    []
  );

  const enterPreview = useCallback(() => setPreview(true), []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
