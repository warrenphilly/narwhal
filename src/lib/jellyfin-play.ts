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

  let sourceId: string | undefined;
  let playSessionId: string | undefined;
  if (response.ok) {
    const info = (await response.json()) as PlaybackInfo;
    sourceId = info.MediaSources?.[0]?.Id;
    playSessionId = info.PlaySessionId;
  }

  const stream = new URL(`${session.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream`);
  stream.searchParams.set("api_key", session.token);
  if (sourceId) stream.searchParams.set("MediaSourceId", sourceId);
  if (playSessionId) stream.searchParams.set("PlaySessionId", playSessionId);

  if (!preferTranscode) {
    stream.searchParams.set("static", "true");
    stream.searchParams.set("Static", "true");
    return stream.toString();
  }

  stream.pathname = `/Videos/${encodeURIComponent(itemId)}/stream.mp4`;
  stream.searchParams.set("Container", "mp4");
  stream.searchParams.set("VideoCodec", "h264");
  stream.searchParams.set("AudioCodec", "aac");
  stream.searchParams.set("TranscodingProtocol", "http");
  stream.searchParams.set("MaxStreamingBitrate", "12000000");
  return stream.toString();
}
