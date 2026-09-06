import type { JellyfinItem, JellyfinItemsResult, MediaStream, PlaybackInfo } from "@/lib/jellyfin-types";
import { authHeader, getConnection } from "@/lib/jellyfin-connection";

const ITEM_FIELDS =
  "Overview,Genres,PrimaryImageAspectRatio,MediaSources,CanDownload,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData,SeriesName,SeriesId,ParentIndexNumber,IndexNumber";

async function jf<T>(path: string, init?: RequestInit): Promise<T> {
  const direct = getConnection();
  const url = direct
    ? `${direct.serverUrl}/${path}`
    : `/api/jf/${path}`;
  const headers = new Headers(init?.headers);
  if (direct) {
    headers.set("Authorization", authHeader(direct.deviceId, direct.token));
  }
  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || `Jellyfin request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function continueImageUrl(item: JellyfinItem) {
  if (item.ImageTags?.Thumb) {
    return imageUrl(item.Id, { type: "Thumb", maxWidth: 720 });
  }
  if (item.BackdropImageTags?.[0]) {
    return imageUrl(item.Id, { type: "Backdrop", maxWidth: 720 });
  }
  return imageUrl(item.Id, { maxWidth: 720 });
}

export function imageUrl(itemId: string, options?: { type?: string; maxWidth?: number; maxHeight?: number; tag?: string }) {
  const type = options?.type ?? "Primary";
  const params = new URLSearchParams();
  if (options?.maxWidth) params.set("maxWidth", String(options.maxWidth));
  if (options?.maxHeight) params.set("maxHeight", String(options.maxHeight));
  if (options?.tag) params.set("tag", options.tag);
  params.set("quality", "90");
  const direct = getConnection();
  if (direct) {
    params.set("api_key", direct.token);
    return `${direct.serverUrl}/Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`;
  }
  return `/api/jf/Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`;
}

export function streamUrl(itemId: string) {
  const direct = getConnection();
  if (direct) {
    return `${direct.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream?static=true&api_key=${encodeURIComponent(direct.token)}`;
  }
  return `/api/jf/Videos/${encodeURIComponent(itemId)}/stream?static=true`;
}

export function downloadUrl(itemId: string, filename: string) {
  const direct = getConnection();
  if (direct) {
    return `${direct.serverUrl}/Items/${encodeURIComponent(itemId)}/Download?api_key=${encodeURIComponent(direct.token)}`;
  }
  return `/api/download/${encodeURIComponent(itemId)}?filename=${encodeURIComponent(filename)}`;
}

export async function fetchMovies(userId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=Movie&Recursive=true&SortBy=SortName&SortOrder=Ascending&Fields=${ITEM_FIELDS}&Limit=200`
  );
  return data.Items ?? [];
}

export async function fetchShows(userId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=Series&Recursive=true&SortBy=SortName&SortOrder=Ascending&Fields=${ITEM_FIELDS}&Limit=200`
  );
  return data.Items ?? [];
}

export async function fetchResume(userId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items/Resume?MediaTypes=Video&Fields=${ITEM_FIELDS}&Limit=40`
  );
  return data.Items ?? [];
}

export async function fetchLatest(userId: string, itemType: "Movie" | "Series" = "Movie") {
  const items = await jf<JellyfinItem[]>(
    `Users/${encodeURIComponent(userId)}/Items/Latest?IncludeItemTypes=${itemType}&Limit=24&Fields=${ITEM_FIELDS}`
  );
  return Array.isArray(items) ? items : [];
}

export async function fetchPlayableId(userId: string, item: JellyfinItem) {
  if (item.Type !== "Series") return item.Id;
  const next = await jf<JellyfinItemsResult>(
    `Shows/NextUp?UserId=${encodeURIComponent(userId)}&SeriesId=${encodeURIComponent(item.Id)}&Limit=1&Fields=${ITEM_FIELDS}`
  );
  if (next.Items?.[0]?.Id) return next.Items[0].Id;
  const episodes = await jf<JellyfinItemsResult>(
    `Shows/${encodeURIComponent(item.Id)}/Episodes?UserId=${encodeURIComponent(userId)}&Limit=1&Fields=${ITEM_FIELDS}`
  );
  return episodes.Items?.[0]?.Id ?? item.Id;
}

export async function fetchMovie(userId: string, id: string) {
  return jf<JellyfinItem>(
    `Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}?Fields=${ITEM_FIELDS}`
  );
}

export async function fetchSeasons(userId: string, seriesId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Shows/${encodeURIComponent(seriesId)}/Seasons?UserId=${encodeURIComponent(userId)}&Fields=${ITEM_FIELDS}`
  );
  return data.Items ?? [];
}

export async function fetchEpisodes(userId: string, seriesId: string, seasonId?: string) {
  const params = new URLSearchParams({
    UserId: userId,
    Fields: ITEM_FIELDS,
  });
  if (seasonId) params.set("SeasonId", seasonId);
  const data = await jf<JellyfinItemsResult>(
    `Shows/${encodeURIComponent(seriesId)}/Episodes?${params.toString()}`
  );
  return data.Items ?? [];
}

export async function fetchNextUp(userId: string, seriesId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Shows/NextUp?UserId=${encodeURIComponent(userId)}&SeriesId=${encodeURIComponent(seriesId)}&Limit=1&Fields=${ITEM_FIELDS}`
  );
  return data.Items?.[0] ?? null;
}

export async function searchMovies(userId: string, query: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?SearchTerm=${encodeURIComponent(query)}&IncludeItemTypes=Movie,Series&Recursive=true&Fields=${ITEM_FIELDS}&Limit=40`
  );
  return data.Items ?? [];
}

export async function fetchPlaybackInfo(itemId: string, userId: string) {
  return jf<PlaybackInfo>(`Items/${encodeURIComponent(itemId)}/PlaybackInfo?UserId=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ UserId: userId }),
  });
}

export function subtitleUrl(itemId: string, mediaSourceId: string, index: number) {
  const direct = getConnection();
  const path = `Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${index}/Stream.vtt`;
  if (direct) {
    return `${direct.serverUrl}/${path}?api_key=${encodeURIComponent(direct.token)}`;
  }
  return `/api/jf/${path}`;
}

export function subtitleTracks(itemId: string, info: PlaybackInfo | null) {
  const source = info?.MediaSources?.[0];
  if (!source?.Id) return [];
  return (source.MediaStreams ?? [])
    .filter((stream): stream is MediaStream & { Index: number } => stream.Type === "Subtitle" && typeof stream.Index === "number")
    .map((stream) => ({
      index: stream.Index,
      label: stream.DisplayTitle || stream.Language || `Subtitle ${stream.Index}`,
      language: stream.Language || "und",
      isDefault: Boolean(stream.IsDefault),
      src: subtitleUrl(itemId, source.Id!, stream.Index),
    }));
}

export async function reportPlaybackStart(itemId: string) {
  const direct = getConnection();
  const url = direct ? `${direct.serverUrl}/Sessions/Playing` : "/api/jf/Sessions/Playing";
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (direct) {
    headers.Authorization = authHeader(direct.deviceId, direct.token);
  }
  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ItemId: itemId, PlayMethod: "DirectPlay" }),
  }).catch(() => undefined);
}
