import { authHeader, type JellyfinSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";
import type { PlaybackInfo } from "@/lib/jellyfin-types";

export const BROWSER_DEVICE_PROFILE = {
  MaxStreamingBitrate: 12_000_000,
  DirectPlayProfiles: [
    { Container: "mp4,m4v,mov", Type: "Video", VideoCodec: "h264", AudioCodec: "aac,mp3" },
  ],
  TranscodingProfiles: [
    {
      Container: "mp4",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "http",
      EstimateContentLength: true,
    },
  ],
};

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
  const relative = preferTranscode
    ? source?.TranscodingUrl || source?.DirectStreamUrl
    : source?.DirectStreamUrl || source?.TranscodingUrl;

  if (relative) {
    return new URL(relative, `${session.serverUrl}/`).toString();
  }

  const fallback = new URL(`${session.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream`);
  fallback.searchParams.set("static", "true");
  if (source?.Id) fallback.searchParams.set("MediaSourceId", source.Id);
  if (info.PlaySessionId) fallback.searchParams.set("PlaySessionId", info.PlaySessionId);
  return fallback.toString();
}
