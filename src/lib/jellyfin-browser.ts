import type { JellyfinAuthResult } from "@/lib/jellyfin-types";
import { authHeader, clientServerUrl } from "@/lib/jellyfin-connection";

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function browserSignIn(input: {
  serverUrl: string;
  username: string;
  password: string;
}) {
  const serverUrl = clientServerUrl(input.serverUrl);
  const deviceId = window.crypto?.randomUUID?.() ?? `cinema-${Date.now()}`;
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(deviceId),
      },
      body: JSON.stringify({
        Username: input.username,
        Pw: input.password,
        Password: input.password,
      }),
    });
  } catch {
    throw new Error(
      `This browser could not reach ${serverUrl}. On a https:// site, home http:// addresses are blocked. Use the Narwhal desktop app on your Wi‑Fi, or Tailscale.`
    );
  }

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Wrong username or password."
        : `Jellyfin returned ${response.status}.`
    );
  }

  const data = await readJsonSafe<JellyfinAuthResult>(response);
  if (!data?.AccessToken || !data.User?.Id) {
    throw new Error("Jellyfin answered, but the sign-in reply was not valid JSON.");
  }

  return {
    serverUrl,
    token: data.AccessToken,
    userId: data.User.Id,
    userName: data.User.Name,
    deviceId,
  };
}
