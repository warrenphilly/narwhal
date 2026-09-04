import { cookies } from "next/headers";

export const SESSION_COOKIE = "jf_session";

export type JellyfinSession = {
  serverUrl: string;
  token: string;
  userId: string;
  userName: string;
  deviceId: string;
  allowInsecure?: boolean;
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
  return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, ""));
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

export async function getSession(): Promise<JellyfinSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JellyfinSession;
    if (!parsed.serverUrl || !parsed.token || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieValue(session: JellyfinSession) {
  return JSON.stringify(session);
}
