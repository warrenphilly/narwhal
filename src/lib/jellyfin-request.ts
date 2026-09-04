import { Agent } from "undici";

const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

type FetchInit = RequestInit & { dispatcher?: Agent };

export function jellyfinFetch(
  url: string,
  init: RequestInit,
  options?: { allowInsecure?: boolean; timeoutMs?: number }
) {
  const timeoutMs = options?.timeoutMs;
  let signal = init.signal;
  if (timeoutMs && timeoutMs > 0) {
    const timeout = AbortSignal.timeout(timeoutMs);
    signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  }
  const next: FetchInit = { ...init, signal };
  if (options?.allowInsecure) {
    next.dispatcher = insecureAgent;
  }
  return fetch(url, next);
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
  const localHint =
    "localhost only works when Cinema and Jellyfin run on the same computer. If you are using the cloud preview, that address is not your laptop — run Cinema locally, or use a public/Tailscale URL.";

  if (err.name === "TimeoutError" || code === "ABORT_ERR" || text.includes("abort") || text.includes("timeout")) {
    return `Timed out reaching ${serverUrl}. ${local ? localHint : "Check the address, port, and that Jellyfin is running."}`;
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
    return `Could not reach ${serverUrl}. ${local ? localHint : "Use http:// or https:// plus the host and port Jellyfin shows in its dashboard."}`;
  }
  return err.message || "Could not reach Jellyfin.";
}
