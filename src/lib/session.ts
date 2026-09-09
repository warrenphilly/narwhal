import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_HEADER,
  parseSessionCookie,
  sessionFromUnknown,
  type JellyfinSession,
} from "@/lib/session-shared";

export {
  SESSION_COOKIE,
  SESSION_HEADER,
  parseSessionCookie,
  sessionFromUnknown,
  type JellyfinSession,
};

export function normalizeServerUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Enter your Jellyfin server address.");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server address must start with http or https.");
  }
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  // Jellyfin's default 8096 is HTTP. HTTPS on that port hangs until timeout.
  if (url.protocol === "https:" && url.port === "8096") {
    url.protocol = "http:";
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (path === "/web" || path.startsWith("/web/")) {
    path = "";
  }
  return url.origin + path;
}

export function authHeader(session: Pick<JellyfinSession, "token" | "deviceId">, token?: string) {
  const parts = [
    'Client="Cinema"',
    'Device="Laptop"',
    `DeviceId="${session.deviceId}"`,
    'Version="1.0.0"',
  ];
  const value = token ?? session.token;
  if (value) {
    parts.push(`Token="${value}"`);
  }
  return `MediaBrowser ${parts.join(", ")}`;
}

/** Prefer base64url so commas in JSON cannot break Set-Cookie parsing. */
export function sessionCookieValue(session: JellyfinSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export async function getSession(): Promise<JellyfinSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return parseSessionCookie(raw);
}

export async function getRequestSession(request?: Request): Promise<JellyfinSession | null> {
  const fromCookie = await getSession();
  if (fromCookie) return fromCookie;
  if (!request) return null;
  const header = request.headers.get(SESSION_HEADER);
  if (header) {
    try {
      const fromHeader = sessionFromUnknown(JSON.parse(header) as unknown);
      if (fromHeader) return fromHeader;
    } catch {
      const fromHeader = parseSessionCookie(header);
      if (fromHeader) return fromHeader;
    }
  }
  try {
    const url = new URL(request.url);
    const jf = url.searchParams.get("jf") || url.searchParams.get("nfsid");
    if (jf) return parseSessionCookie(jf);
  } catch {
    /* ignore */
  }
  return null;
}

/** Narwhal desktop always runs on http://127.0.0.1 — Secure cookies would never stick. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
