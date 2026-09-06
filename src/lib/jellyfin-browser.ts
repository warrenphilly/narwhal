import type { JellyfinAuthResult } from "@/lib/jellyfin-types";
import { authHeader, clientServerUrl } from "@/lib/jellyfin-connection";

export async function browserSignIn(input: {
  serverUrl: string;
  username: string;
  password: string;
}) {
  const serverUrl = clientServerUrl(input.serverUrl);
  const deviceId =
    window.crypto?.randomUUID?.() ?? `cinema-${Date.now()}`;
  const response = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
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
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Wrong username or password."
        : `Jellyfin returned ${response.status}.`
    );
  }
  const data = (await response.json()) as JellyfinAuthResult;
  return {
    serverUrl,
    token: data.AccessToken,
    userId: data.User.Id,
    userName: data.User.Name,
    deviceId,
  };
}
