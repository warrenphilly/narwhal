import { Agent } from "undici";

const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

type FetchInit = RequestInit & { dispatcher?: Agent };

export type TunnelAuth = {
  allowInsecure?: boolean;
  timeoutMs?: number;
  cfAccessClientId?: string;
  cfAccessClientSecret?: string;
  cfAccessJwt?: string;
};

export function applyTunnelHeaders(headers: Headers, auth?: TunnelAuth) {
  if (auth?.cfAccessClientId && auth?.cfAccessClientSecret) {
    headers.set("CF-Access-Client-Id", auth.cfAccessClientId);
    headers.set("CF-Access-Client-Secret", auth.cfAccessClientSecret);
  }
  if (auth?.cfAccessJwt) {
    const token = auth.cfAccessJwt.trim();
    headers.set("CF-Access-Jwt-Assertion", token);
    const existing = headers.get("Cookie");
    const pair = `CF_Authorization=${token}`;
    headers.set("Cookie", existing ? `${existing}; ${pair}` : pair);
  }
}

/** Home/LAN addresses the Vercel cloud host cannot dial (causes platform 500s). */
export function isLanOnlyHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("100.")) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

export function assertCloudCanReachJellyfin(url: string) {
  if (!process.env.VERCEL) return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  if (!isLanOnlyHost(host)) return;
  throw new Error(
    "This cloud website cannot reach your home Jellyfin. Use the Narwhal desktop app on Wi‑Fi, or sign in with a public / HTTPS Jellyfin address (for example Tailscale Serve)."
  );
}

export function jellyfinFetch(url: string, init: RequestInit, options?: TunnelAuth) {
  assertCloudCanReachJellyfin(url);
  const timeoutMs = options?.timeoutMs;
  let signal = init.signal;
  if (timeoutMs && timeoutMs > 0) {
    const timeout = AbortSignal.timeout(timeoutMs);
    signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  }
  const headers = new Headers(init.headers);
  applyTunnelHeaders(headers, options);
  const next: FetchInit = { ...init, headers, signal };
  if (options?.allowInsecure) {
    next.dispatcher = insecureAgent;
  }
  return fetch(url, next);
}

export function looksLikeCloudflareAccess(response: Response, body: string) {
  const location = response.headers.get("location") ?? "";
  const type = response.headers.get("content-type") ?? "";
  const text = body.slice(0, 4000).toLowerCase();
  return (
    location.includes("cloudflareaccess.com") ||
    type.includes("text/html") ||
    text.includes("cloudflare access") ||
    text.includes("cloudflareaccess.com") ||
    text.includes("cf-access")
  );
}

export function isTailscaleHost(host: string) {
  if (host.endsWith(".ts.net")) return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

export function tunnelFromSession(session: {
  allowInsecure?: boolean;
  cfAccessClientId?: string;
  cfAccessClientSecret?: string;
  cfAccessJwt?: string;
}): TunnelAuth {
  return {
    allowInsecure: session.allowInsecure,
    cfAccessClientId: session.cfAccessClientId,
    cfAccessClientSecret: session.cfAccessClientSecret,
    cfAccessJwt: session.cfAccessJwt,
  };
}

export function describeConnectError(error: unknown, serverUrl: string) {
  const err = error as Error & { cause?: NodeJS.ErrnoException; code?: string };
  const cause = err.cause;
  const code = cause?.code || err.code || "";
  const text = `${err.message ?? ""} ${cause?.message ?? ""} ${code}`.toLowerCase();
  let host = serverUrl;
  try {
    host = new URL(serverUrl).hostname;
  } catch {
    host = serverUrl;
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const tailscale = isTailscaleHost(host);
  const localHint =
    "localhost only works when Cinema and Jellyfin run on the same computer. If you are using the cloud preview, that address is not your laptop — run Cinema locally, or use a public/Tailscale URL.";
  const tailscaleHint =
    "Tailscale is probably fine. On TrueNAS, Jellyfin often listens only on the home LAN, not 100.x:8096. In Terminal on this Mac run: curl -m 5 http://100.121.26.58:8096/System/Info/Public — if that hangs, enable a Tailscale subnet route on the NAS (or Tailscale Serve on 8096), then use the NAS home IP (192.168.x.x:8096) while Tailscale is on.";

  if (err.name === "TimeoutError" || code === "ABORT_ERR" || text.includes("abort") || text.includes("timeout")) {
    return `Timed out reaching ${serverUrl}. ${tailscale ? tailscaleHint : local ? localHint : "Check the address, port, and that Jellyfin is running."}`;
  }
  if (
    text.includes("certificate") ||
    text.includes("ssl") ||
    text.includes("tls") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID"
  ) {
    return "The HTTPS certificate was rejected. Check “Allow self-signed certificate” and try again.";
  }
  if (code === "ECONNREFUSED" || text.includes("econnrefused")) {
    return local
      ? `Nothing answered at ${serverUrl}. Start Jellyfin on this computer, or ${localHint}`
      : `Connection refused at ${serverUrl}. Is Jellyfin running, and can this machine reach that address?`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || text.includes("enotfound")) {
    return `Could not find host “${host}”. Use the server IP or a hostname this computer can resolve.`;
  }
  if (text.includes("fetch failed")) {
    return `Could not reach ${serverUrl}. ${tailscale ? tailscaleHint : local ? localHint : "Use http:// or https:// plus the host and port Jellyfin shows in its dashboard."}`;
  }
  return err.message || "Could not reach Jellyfin.";
}
