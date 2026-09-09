export const SESSION_COOKIE = "jf_session";
/** Browser may send this when the httpOnly cookie is missing (Electron port changes, etc.). */
export const SESSION_HEADER = "x-narwhal-jf";

export type JellyfinSession = {
  serverUrl: string;
  token: string;
  userId: string;
  userName: string;
  deviceId: string;
  allowInsecure?: boolean;
  cfAccessClientId?: string;
  cfAccessClientSecret?: string;
  cfAccessJwt?: string;
};

export function sessionFromUnknown(parsed: unknown): JellyfinSession | null {
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Partial<JellyfinSession>;
  if (!row.serverUrl || !row.token || !row.userId) return null;
  return {
    serverUrl: String(row.serverUrl),
    token: String(row.token),
    userId: String(row.userId),
    userName: String(row.userName || "User"),
    deviceId: String(row.deviceId || `narwhal-${row.userId}`),
    allowInsecure: row.allowInsecure,
    cfAccessClientId: row.cfAccessClientId,
    cfAccessClientSecret: row.cfAccessClientSecret,
    cfAccessJwt: row.cfAccessJwt,
  };
}

export function parseSessionCookie(raw: string): JellyfinSession | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith("{")) {
      return sessionFromUnknown(JSON.parse(trimmed) as unknown);
    }
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(trimmed, "base64url").toString("utf8")
        : atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"));
    return sessionFromUnknown(JSON.parse(json) as unknown);
  } catch {
    try {
      return sessionFromUnknown(JSON.parse(decodeURIComponent(trimmed)) as unknown);
    } catch {
      return null;
    }
  }
}
