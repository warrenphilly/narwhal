import type { JellyfinItem, JellyfinItemsResult, MediaStream, PlaybackInfo } from "@/lib/jellyfin-types";
import { authHeader, getConnection } from "@/lib/jellyfin-connection";

const ITEM_FIELDS =
  "Overview,Genres,PrimaryImageAspectRatio,MediaSources,CanDownload,ProductionYear,DateCreated,PremiereDate,CommunityRating,CriticRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,People,Studios,RemoteTrailers,Taglines,Status,ProductionLocations,ChildCount,MediaStreams";

async function parseBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function jf<T>(path: string, init?: RequestInit): Promise<T> {
  const direct = getConnection();
  const headers = new Headers(init?.headers);
  const proxy = await fetch(`/api/jf/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (proxy.ok) return parseBody<T>(proxy);
  if (direct && (proxy.status === 401 || proxy.status === 502)) {
    headers.set("Authorization", authHeader(direct.deviceId, direct.token));
    const response = await fetch(`${direct.serverUrl}/${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || `Jellyfin request failed (${response.status})`);
    }
    return parseBody<T>(response);
  }
  const data = (await proxy.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error || `Jellyfin request failed (${proxy.status})`);
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

async function fetchLibrary(userId: string, itemType: "Movie" | "Series") {
  const params = new URLSearchParams({
    IncludeItemTypes: itemType,
    Recursive: "true",
    SortBy: "SortName",
    SortOrder: "Ascending",
    Fields: ITEM_FIELDS,
    Limit: "1000",
    EnableUserData: "true",
  });
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?${params.toString()}`
  );
  if (data.Items?.length) return data.Items;
  const views = await jf<JellyfinItemsResult>(`Users/${encodeURIComponent(userId)}/Views`).catch(
    () => ({ Items: [] as JellyfinItem[] })
  );
  const collected: JellyfinItem[] = [];
  for (const view of views.Items ?? []) {
    const page = await jf<JellyfinItemsResult>(
      `Users/${encodeURIComponent(userId)}/Items?ParentId=${encodeURIComponent(view.Id)}&IncludeItemTypes=${itemType}&Recursive=true&SortBy=SortName&Fields=${ITEM_FIELDS}&Limit=1000`
    ).catch(() => ({ Items: [] as JellyfinItem[] }));
    collected.push(...(page.Items ?? []));
  }
  return uniqueItems(collected);
}

export async function fetchMovies(userId: string) {
  return fetchLibrary(userId, "Movie");
}

export async function fetchShows(userId: string) {
  return fetchLibrary(userId, "Series");
}

export async function fetchResume(userId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items/Resume?MediaTypes=Video&Fields=${ITEM_FIELDS}&Limit=40`
  );
  return data.Items ?? [];
}

export async function fetchLatest(userId: string, itemType: "Movie" | "Series" | "Episode" = "Movie") {
  const items = await jf<JellyfinItem[]>(
    `Users/${encodeURIComponent(userId)}/Items/Latest?IncludeItemTypes=${itemType}&Limit=24&Fields=${ITEM_FIELDS}`
  );
  return Array.isArray(items) ? items : [];
}

export async function fetchUnplayedRecent(
  userId: string,
  itemType: "Movie" | "Series" | "Episode"
) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=${itemType}&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Filters=IsUnplayed&Fields=${ITEM_FIELDS}&Limit=24`
  );
  return data.Items ?? [];
}

const NEW_MS = 21 * 24 * 60 * 60 * 1000;

export function isNewRelease(item: JellyfinItem) {
  const stamps = [item.DateCreated, item.PremiereDate];
  return stamps.some((raw) => {
    if (!raw) return false;
    const time = new Date(raw).getTime();
    return !Number.isNaN(time) && Date.now() - time < NEW_MS;
  });
}

export function uniqueItems(items: JellyfinItem[]) {
  const seen = new Set<string>();
  const next: JellyfinItem[] = [];
  for (const item of items) {
    if (seen.has(item.Id)) continue;
    seen.add(item.Id);
    next.push(item);
  }
  return next;
}

export function featuredWithNewReleases(current: JellyfinItem[], incoming: JellyfinItem[]) {
  const fresh = uniqueItems(incoming);
  if (!fresh.length) return current;
  return uniqueItems([...fresh, ...current]);
}

export function seriesForNewEpisodes(episodes: JellyfinItem[], catalog: JellyfinItem[]) {
  const byId = new Map(catalog.map((show) => [show.Id, show]));
  const seen = new Set<string>();
  const next: JellyfinItem[] = [];
  for (const episode of episodes) {
    const seriesId = episode.SeriesId;
    if (!seriesId || seen.has(seriesId)) continue;
    seen.add(seriesId);
    next.push(
      byId.get(seriesId) ?? {
        Id: seriesId,
        Name: episode.SeriesName || "Series",
        Type: "Series",
        DateCreated: episode.DateCreated,
        PremiereDate: episode.PremiereDate,
      }
    );
  }
  return next;
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

export async function fetchLocalTrailers(userId: string, itemId: string) {
  const data = await jf<JellyfinItemsResult | JellyfinItem[]>(
    `Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}/LocalTrailers?Fields=${ITEM_FIELDS}`
  );
  return Array.isArray(data) ? data : data.Items ?? [];
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

export async function setPlayed(userId: string, itemId: string, played: boolean) {
  await jf<Record<string, never>>(
    `Users/${encodeURIComponent(userId)}/PlayedItems/${encodeURIComponent(itemId)}`,
    { method: played ? "POST" : "DELETE" }
  );
}

export async function reportPlaybackStopped(itemId: string, positionTicks?: number) {
  const direct = getConnection();
  const url = direct ? `${direct.serverUrl}/Sessions/Playing/Stopped` : "/api/jf/Sessions/Playing/Stopped";
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (direct) {
    headers.Authorization = authHeader(direct.deviceId, direct.token);
  }
  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ItemId: itemId, PositionTicks: positionTicks ?? 0 }),
  }).catch(() => undefined);
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
