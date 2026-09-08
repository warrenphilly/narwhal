"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getConnection, rememberConnection, setConnection } from "@/lib/jellyfin-connection";
import { browserSignIn } from "@/lib/jellyfin-browser";

export type SessionInfo = {
  signedIn: boolean;
  userName?: string;
  userId?: string;
  serverUrl?: string;
  token?: string;
  deviceId?: string;
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

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function isLocalJellyfinHost(serverUrl: string) {
  try {
    const host = new URL(/^https?:\/\//i.test(serverUrl) ? serverUrl : `http://${serverUrl}`).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("100.")) return true;
    return /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  } catch {
    return false;
  }
}

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
    const data = await readJsonSafe<SessionInfo>(response);
    if (!data) {
      setSession({ signedIn: false });
      return;
    }
    if (data.signedIn) rememberConnection(data);
    setSession(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => readJsonSafe<SessionInfo>(response))
      .then(async (data) => {
        if (cancelled) return;
        const stored = getConnection();
        if (stored) {
          await fetch("/api/auth/adopt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stored),
          }).catch(() => undefined);
          if (cancelled) return;
          setSession({
            signedIn: true,
            userName: stored.userName,
            userId: stored.userId,
            serverUrl: stored.serverUrl,
          });
          return;
        }
        if (data?.signedIn) rememberConnection(data);
        setSession(data ?? { signedIn: false });
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

  const finishSignIn = useCallback((data: SessionInfo & { token?: string; deviceId?: string }) => {
    rememberConnection(data);
    window.sessionStorage.removeItem("cinema-preview");
    setPreview(false);
    setSession({ ...data, signedIn: true });
  }, []);

  const signInWithBrowser = useCallback(
    async (input: { serverUrl: string; username: string; password: string }) => {
      const direct = await browserSignIn(input);
      setConnection(direct);
      await fetch("/api/auth/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(direct),
      }).catch(() => undefined);
      finishSignIn({
        signedIn: true,
        userName: direct.userName,
        userId: direct.userId,
        serverUrl: direct.serverUrl,
        token: direct.token,
        deviceId: direct.deviceId,
      });
    },
    [finishSignIn]
  );

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
      const localHost = isLocalJellyfinHost(input.serverUrl);

      // Home Wi‑Fi / Tailscale: talk to Jellyfin from this device first.
      // Cloud servers often cannot reach those private addresses.
      if (localHost) {
        try {
          await signInWithBrowser(input);
          return;
        } catch (browserError) {
          // Fall through to app-server login (Electron can still proxy LAN).
          if (!(browserError instanceof Error)) {
            /* continue */
          }
        }
      }

      let serverError = "Could not sign in.";
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await readJsonSafe<SessionInfo & { error?: string }>(response);
        if (!data) {
          serverError =
            response.status >= 500
              ? "Narwhal’s login API is not responding. Try the desktop app on your home network."
              : `Sign-in failed (${response.status}). The server returned a web page instead of JSON.`;
        } else if (response.ok) {
          finishSignIn({ ...data, signedIn: true });
          return;
        } else {
          serverError = data.error || serverError;
        }
      } catch {
        serverError = "Could not reach Narwhal’s login API.";
      }

      try {
        await signInWithBrowser(input);
      } catch (browserError) {
        const message =
          browserError instanceof Error && browserError.message
            ? browserError.message
            : serverError;
        setError(message);
        throw new Error(message);
      }
    },
    [finishSignIn, signInWithBrowser]
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
