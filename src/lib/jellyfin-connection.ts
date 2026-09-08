const STORAGE_KEY = "cinema-direct";

export type DirectConnection = {
  serverUrl: string;
  token: string;
  userId: string;
  userName: string;
  deviceId: string;
};

let memory: DirectConnection | null = null;

export function getConnection() {
  if (memory) return memory;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    memory = JSON.parse(raw) as DirectConnection;
    return memory;
  } catch {
    return null;
  }
}

export function setConnection(next: DirectConnection | null) {
  memory = next;
  if (typeof window === "undefined") return;
  if (next) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function rememberConnection(data: {
  serverUrl?: string;
  token?: string;
  userId?: string;
  userName?: string;
  deviceId?: string;
}) {
  if (!data.serverUrl || !data.token || !data.userId) return;
  setConnection({
    serverUrl: data.serverUrl,
    token: data.token,
    userId: data.userId,
    userName: data.userName || "User",
    deviceId: data.deviceId || `narwhal-${data.userId}`,
  });
}

export function authHeader(deviceId: string, token?: string) {
  const parts = [
    'Client="Cinema"',
    'Device="Laptop"',
    `DeviceId="${deviceId}"`,
    'Version="1.0.0"',
  ];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

export function clientServerUrl(input: string) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol === "https:" && url.port === "8096") {
    url.protocol = "http:";
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (path === "/web" || path.startsWith("/web/")) path = "";
  return url.origin + path;
}
