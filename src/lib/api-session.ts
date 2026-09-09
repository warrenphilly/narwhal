import { getConnection } from "@/lib/jellyfin-connection";
import { SESSION_HEADER } from "@/lib/session-shared";

/** Headers for Narwhal /api calls — cookie + localStorage session backup. */
export function apiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const direct = getConnection();
  if (direct?.token && direct.serverUrl && direct.userId && !headers.has(SESSION_HEADER)) {
    headers.set(
      SESSION_HEADER,
      JSON.stringify({
        serverUrl: direct.serverUrl,
        token: direct.token,
        userId: direct.userId,
        userName: direct.userName,
        deviceId: direct.deviceId,
      })
    );
  }
  return headers;
}

export async function ensureServerSession() {
  const direct = getConnection();
  if (!direct?.token) return false;
  try {
    const response = await fetch("/api/auth/adopt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(direct),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function apiFetch(input: string, init?: RequestInit) {
  const headers = apiHeaders(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
}
