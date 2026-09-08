import { authHeader, type JellyfinSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";
import { BROWSER_DEVICE_PROFILE } from "@/lib/device-profile";
import type { PlaybackInfo } from "@/lib/jellyfin-types";

export async function resolveJellyfinPlayUrl(
  session: JellyfinSession,
  itemId: string,
  preferTranscode = false
) {
  const infoUrl = `${session.serverUrl}/Items/${encodeURIComponent(itemId)}/PlaybackInfo?UserId=${encodeURIComponent(session.userId)}`;
  const response = await jellyfinFetch(
    infoUrl,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(session),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        UserId: session.userId,
        MaxStreamingBitrate: 12_000_000,
        AutoOpenLiveStream: true,
        DeviceProfile: BROWSER_DEVICE_PROFILE,
      }),
    },
    { ...tunnelFromSession(session), timeoutMs: 20_000 }
  );

  if (!response.ok) {
    throw new Error(`PlaybackInfo failed (${response.status})`);
  }

  const info = (await response.json()) as PlaybackInfo;
  const source = info.MediaSources?.[0];
  const relative = source?.TranscodingUrl || (preferTranscode ? undefined : source?.DirectStreamUrl);

  if (relative) {
    return new URL(relative, `${session.serverUrl}/`).toString();
  }

  const fallback = new URL(`${session.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream.mp4`);
  fallback.searchParams.set("Container", "mp4");
  fallback.searchParams.set("VideoCodec", "h264");
  fallback.searchParams.set("AudioCodec", "aac");
  fallback.searchParams.set("TranscodingProtocol", "http");
  fallback.searchParams.set("MaxStreamingBitrate", "12000000");
  if (source?.Id) fallback.searchParams.set("MediaSourceId", source.Id);
  if (info.PlaySessionId) fallback.searchParams.set("PlaySessionId", info.PlaySessionId);
  return fallback.toString();
}
