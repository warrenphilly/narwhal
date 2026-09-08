import { authHeader, type JellyfinSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";
import { BROWSER_DEVICE_PROFILE, HLS_DEVICE_PROFILE, WEB_AUDIO, WEB_CONTAINERS, WEB_VIDEO } from "@/lib/device-profile";
import type { PlaybackInfo } from "@/lib/jellyfin-types";

type MediaLook = {
  container: string;
  videoCodec: string;
  audioCodec: string;
  bitDepth: number;
  sourceId?: string;
};

async function inspectMedia(session: JellyfinSession, itemId: string, audioIndex?: number): Promise<MediaLook | null> {
  const url = `${session.serverUrl}/Items/${encodeURIComponent(itemId)}?Fields=MediaStreams,MediaSources`;
  const response = await jellyfinFetch(
    url,
    { headers: { Authorization: authHeader(session) } },
    { ...tunnelFromSession(session), timeoutMs: 8_000 }
  );
  if (!response.ok) return null;
  const item = (await response.json()) as {
    Container?: string;
    MediaStreams?: { Type?: string; Index?: number; Codec?: string; IsDefault?: boolean; BitDepth?: number; Profile?: string }[];
    MediaSources?: {
      Id?: string;
      Container?: string;
      MediaStreams?: { Type?: string; Index?: number; Codec?: string; IsDefault?: boolean; BitDepth?: number; Profile?: string }[];
    }[];
  };
  const source = item.MediaSources?.[0];
  const streams = source?.MediaStreams ?? item.MediaStreams ?? [];
  const video = streams.find((stream) => stream.Type === "Video");
  const audios = streams.filter((stream) => stream.Type === "Audio");
  const audio =
    typeof audioIndex === "number"
      ? audios.find((stream) => stream.Index === audioIndex)
      : audios.find((stream) => stream.IsDefault) ?? audios[0];
  return {
    container: (source?.Container || item.Container || "").toLowerCase().replace(/^\./, ""),
    videoCodec: (video?.Codec || "").toLowerCase(),
    audioCodec: (audio?.Codec || "").toLowerCase(),
    bitDepth: video?.BitDepth ?? ((video?.Profile || "").toLowerCase().includes("10") ? 10 : 8),
    sourceId: source?.Id,
  };
}

function canDirectPlay(look: MediaLook | null) {
  if (!look?.container || !look.videoCodec) return false;
  if (!WEB_CONTAINERS.has(look.container)) return false;
  if (!WEB_VIDEO.has(look.videoCodec)) return false;
  if (look.audioCodec && !WEB_AUDIO.has(look.audioCodec)) return false;
  if (look.bitDepth > 8) return false;
  return true;
}

export async function resolveJellyfinPlayUrl(
  session: JellyfinSession,
  itemId: string,
  preferTranscode = false,
  audioIndex?: number,
  startTicks = 0,
  hardTranscode = false
) {
  const look = await inspectMedia(session, itemId, audioIndex).catch(() => null);
  const stream = new URL(`${session.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream`);
  stream.searchParams.set("api_key", session.token);
  if (typeof audioIndex === "number") stream.searchParams.set("AudioStreamIndex", String(audioIndex));
  if (look?.sourceId) stream.searchParams.set("MediaSourceId", look.sourceId);

  const probed = Boolean(look?.container && look.videoCodec);
  if (!preferTranscode && !hardTranscode && probed && canDirectPlay(look)) {
    stream.searchParams.set("static", "true");
    stream.searchParams.set("Static", "true");
    return stream.toString();
  }

  if (startTicks > 0) stream.searchParams.set("StartTimeTicks", String(Math.round(startTicks)));

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
        MaxStreamingBitrate: 20_000_000,
        AutoOpenLiveStream: true,
        AudioStreamIndex: audioIndex,
        StartTimeTicks: startTicks > 0 ? Math.round(startTicks) : undefined,
        DeviceProfile: BROWSER_DEVICE_PROFILE,
      }),
    },
    { ...tunnelFromSession(session), timeoutMs: 20_000 }
  );

  if (response.ok) {
    const info = (await response.json()) as PlaybackInfo;
    const source = info.MediaSources?.[0];
    if (source?.Id) stream.searchParams.set("MediaSourceId", source.Id);
    if (info.PlaySessionId) stream.searchParams.set("PlaySessionId", info.PlaySessionId);
  }

  stream.pathname = `/Videos/${encodeURIComponent(itemId)}/stream.mp4`;
  stream.searchParams.set("Container", "mp4");
  stream.searchParams.set("VideoCodec", "h264");
  stream.searchParams.set("AudioCodec", "aac");
  stream.searchParams.set("TranscodingProtocol", "http");
  stream.searchParams.set("Context", "Streaming");
  stream.searchParams.set("CopyTimestamps", "false");
  stream.searchParams.set("EnableAutoStreamCopy", "false");
  stream.searchParams.set("AudioBitrate", "192000");
  stream.searchParams.set("TranscodingMaxAudioChannels", "2");
  stream.searchParams.set("MaxStreamingBitrate", "12000000");
  stream.searchParams.set("VideoBitrate", "8000000");
  stream.searchParams.set("MaxWidth", "1920");
  stream.searchParams.set("MaxHeight", "1080");
  return stream.toString();
}

// Segmented HLS transcode (used instead of the old progressive stream.mp4 path).
// Jellyfin re-anchors audio/video timestamps at every segment boundary, so drift
// from a real-time transcode can't accumulate the way it can on a raw mp4 stream.
export async function resolveJellyfinHlsUrl(
  session: JellyfinSession,
  itemId: string,
  audioIndex?: number,
  startTicks = 0
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
        MaxStreamingBitrate: 20_000_000,
        AutoOpenLiveStream: true,
        AudioStreamIndex: audioIndex,
        StartTimeTicks: startTicks > 0 ? Math.round(startTicks) : undefined,
        DeviceProfile: HLS_DEVICE_PROFILE,
      }),
    },
    { ...tunnelFromSession(session), timeoutMs: 20_000 }
  );
  if (!response.ok) {
    throw new Error(`Could not start HLS playback (${response.status})`);
  }
  const info = (await response.json()) as PlaybackInfo;
  const relative = info.MediaSources?.[0]?.TranscodingUrl;
  if (!relative) {
    throw new Error("Jellyfin did not return an HLS playlist for this title.");
  }
  // Don't stamp StartTimeTicks onto this URL directly: Jellyfin copies every
  // query param on the playlist request down onto the child .ts segment
  // requests it generates, and it rejects segment fetches that carry
  // StartTimeTicks (400). The PlaybackInfo body value above is the only
  // supported way to influence where the resulting session starts.
  return new URL(relative, `${session.serverUrl}/`).toString();
}
