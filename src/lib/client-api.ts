import type { JellyfinItem, JellyfinItemsResult, MediaStream, PlaybackInfo } from "@/lib/jellyfin-types";
import { getConnection } from "@/lib/jellyfin-connection";
import { BROWSER_DEVICE_PROFILE } from "@/lib/device-profile";

const ITEM_FIELDS =
  "Overview,Genres,PrimaryImageAspectRatio,MediaSources,CanDownload,ProductionYear,DateCreated,PremiereDate,CommunityRating,CriticRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,People,Studios,RemoteTrailers,Taglines,Status,ProductionLocations,ChildCount,MediaStreams";

const LIST_FIELDS =
  "Overview,Genres,ProductionYear,DateCreated,PremiereDate,CommunityRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,ChildCount";

function asItemList(data: unknown): JellyfinItem[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is JellyfinItem => Boolean(row && ((row as JellyfinItem).Id || (row as { id?: string }).id)));
  }
  if (data && typeof data === "object") {
    const obj = data as { Items?: JellyfinItem[]; items?: JellyfinItem[] };
    const items = obj.Items ?? obj.items;
    if (Array.isArray(items)) {
      return items.filter((row) => Boolean(row && (row.Id || (row as { id?: string }).id)));
    }
  }
  return [];
}

async function parseBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function jf<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  let proxy: Response;
  try {
    proxy = await fetch(`/api/jf/${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Could not reach the Jellyfin proxy. Refresh and sign in again.");
  }
  if (proxy.ok) return parseBody<T>(proxy);
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

export function imageUrl(
  itemId: string,
  options?: {
    type?: string;
    maxWidth?: number;
    maxHeight?: number;
    fillWidth?: number;
    fillHeight?: number;
    tag?: string;
  }
) {
  const type = options?.type ?? "Primary";
  const params = new URLSearchParams();
  if (options?.maxWidth) params.set("maxWidth", String(options.maxWidth));
  if (options?.maxHeight) params.set("maxHeight", String(options.maxHeight));
  if (options?.fillWidth) params.set("fillWidth", String(options.fillWidth));
  if (options?.fillHeight) params.set("fillHeight", String(options.fillHeight));
  if (options?.tag) params.set("tag", options.tag);
  params.set("quality", "70");
  const path = `Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`;
  const direct = getConnection();
  if (direct?.serverUrl && direct.token) {
    params.set("api_key", direct.token);
    return `${direct.serverUrl}/Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`;
  }
  return `/api/jf/${path}`;
}

export function heroImage(item: JellyfinItem) {
  if (item.BackdropImageTags?.length) {
    return {
      url: imageUrl(item.Id, { type: "Backdrop", fillWidth: 1280, fillHeight: 720 }),
      fit: "cover" as const,
    };
  }
  if (item.ImageTags?.Thumb) {
    return {
      url: imageUrl(item.Id, { type: "Thumb", fillWidth: 1280, fillHeight: 720 }),
      fit: "cover" as const,
    };
  }
  return {
    url: imageUrl(item.Id, { type: "Primary", maxHeight: 720 }),
    fit: "contain" as const,
  };
}

export function streamUrl(
  itemId: string,
  _info?: PlaybackInfo | null,
  forceTranscode = false,
  audioIndex?: number,
  startTicks = 0,
  hardTranscode = false
) {
  const params = new URLSearchParams();
  if (forceTranscode || hardTranscode) params.set("transcode", "1");
  if (hardTranscode) params.set("hard", "1");
  if (typeof audioIndex === "number") params.set("audio", String(audioIndex));
  if (startTicks > 0) params.set("startTicks", String(Math.round(startTicks)));
  const query = params.toString();
  return `/api/play/${encodeURIComponent(itemId)}${query ? `?${query}` : ""}`;
}

export function hlsUrl(itemId: string, audioIndex?: number, startTicks = 0, sessionKey = 0) {
  const params = new URLSearchParams();
  if (typeof audioIndex === "number") params.set("audio", String(audioIndex));
  if (startTicks > 0) params.set("startTicks", String(Math.round(startTicks)));
  if (sessionKey > 0) params.set("sid", String(sessionKey));
  const query = params.toString();
  return `/api/play/${encodeURIComponent(itemId)}/master.m3u8${query ? `?${query}` : ""}`;
}

export function downloadUrl(itemId: string, filename: string) {
  const direct = getConnection();
  if (direct) {
    return `${direct.serverUrl}/Items/${encodeURIComponent(itemId)}/Download?api_key=${encodeURIComponent(direct.token)}`;
  }
  return `/api/download/${encodeURIComponent(itemId)}?filename=${encodeURIComponent(filename)}`;
}

function libraryParams(userId: string, itemType: "Movie" | "Series", parentId?: string) {
  const params = new URLSearchParams({
    UserId: userId,
    IncludeItemTypes: itemType,
    Recursive: "true",
    SortBy: "SortName",
    SortOrder: "Ascending",
    Fields: LIST_FIELDS,
    Limit: "500",
    EnableImageTypes: "Primary,Backdrop,Thumb,Logo",
  });
  if (parentId) params.set("ParentId", parentId);
  return params;
}

export async function fetchViews(userId: string) {
  return asItemList(
    await jf<JellyfinItemsResult | JellyfinItem[]>(`Users/${encodeURIComponent(userId)}/Views`).catch(() => [])
  );
}

function viewMatches(view: JellyfinItem, itemType: "Movie" | "Series") {
  const kind = (view.CollectionType || "").toLowerCase();
  if (!kind || kind === "mixed" || kind === "folder" || kind === "boxsets") return true;
  if (itemType === "Movie") return kind === "movies" || kind === "homevideos" || kind === "musicvideos";
  return kind === "tvshows";
}

async function fetchLibrary(userId: string, itemType: "Movie" | "Series") {
  const paths = [
    `Users/${encodeURIComponent(userId)}/Items?${libraryParams(userId, itemType).toString()}`,
    `Items?${libraryParams(userId, itemType).toString()}`,
  ];
  for (const path of paths) {
    const items = asItemList(await jf<JellyfinItemsResult | JellyfinItem[]>(path).catch(() => []));
    if (items.length) return items;
  }

  const views = await fetchViews(userId);
  const collected: JellyfinItem[] = [];
  for (const view of views.filter((row) => viewMatches(row, itemType))) {
    const page = asItemList(
      await jf<JellyfinItemsResult | JellyfinItem[]>(
        `Users/${encodeURIComponent(userId)}/Items?${libraryParams(userId, itemType, view.Id).toString()}`
      ).catch(() => [])
    );
    collected.push(...page);
  }
  return uniqueItems(collected);
}

export async function fetchLibraryPage(itemType: "Movie" | "Series") {
  const response = await fetch(`/api/library?type=${itemType}`, { cache: "no-store" });
  const data = (await response.json()) as {
    items?: JellyfinItem[];
    views?: { id: string; name: string; collectionType?: string }[];
    serverUrl?: string;
    totalRecordCount?: number;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || "Could not load the library.");
  return {
    items: data.items ?? [],
    views: data.views ?? [],
    serverUrl: data.serverUrl ?? "",
    totalRecordCount: data.totalRecordCount,
  };
}

export async function fetchMovies(userId?: string) {
  if (userId) {
    const viaProxy = await fetchLibrary(userId, "Movie");
    if (viaProxy.length) return viaProxy;
  }
  return (await fetchLibraryPage("Movie")).items;
}

export async function fetchShows(userId?: string) {
  if (userId) {
    const viaProxy = await fetchLibrary(userId, "Series");
    if (viaProxy.length) return viaProxy;
  }
  return (await fetchLibraryPage("Series")).items;
}

export async function fetchResume(userId: string) {
  return asItemList(
    await jf<JellyfinItemsResult | JellyfinItem[]>(
      `Users/${encodeURIComponent(userId)}/Items/Resume?MediaTypes=Video&Fields=${LIST_FIELDS}&Limit=40`
    )
  );
}

export async function fetchLatest(userId: string, itemType: "Movie" | "Series" | "Episode" = "Movie") {
  return asItemList(
    await jf<JellyfinItem[] | JellyfinItemsResult>(
      `Users/${encodeURIComponent(userId)}/Items/Latest?IncludeItemTypes=${itemType}&Limit=24&Fields=${LIST_FIELDS}`
    )
  );
}

export async function fetchUnplayedRecent(
  userId: string,
  itemType: "Movie" | "Series" | "Episode"
) {
  return asItemList(
    await jf<JellyfinItemsResult | JellyfinItem[]>(
      `Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=${itemType}&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Filters=IsUnplayed&Fields=${LIST_FIELDS}&Limit=24`
    )
  );
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

export function uniqueContinueItems(
  items: JellyfinItem[],
  opts?: {
    progress?: Record<string, { updatedAt: number }>;
    lastEpisodeBySeries?: Record<string, { episodeId: string; updatedAt: number }>;
  }
) {
  const progress = opts?.progress ?? {};
  const lastBySeries = opts?.lastEpisodeBySeries ?? {};

  function pickEpisodeForSeries(seriesId: string, candidates: JellyfinItem[]) {
    if (!candidates.length) return null;
    const preferred = lastBySeries[seriesId]?.episodeId;
    if (preferred) {
      const match = candidates.find((episode) => episode.Id === preferred);
      if (match) return match;
    }
    return candidates.reduce((best, episode) => {
      const bestAt = progress[best.Id]?.updatedAt ?? 0;
      const nextAt = progress[episode.Id]?.updatedAt ?? 0;
      return nextAt > bestAt ? episode : best;
    });
  }

  const episodes: JellyfinItem[] = [];
  const rest: JellyfinItem[] = [];
  for (const item of items) {
    if (item.Type === "Episode") episodes.push(item);
    else rest.push(item);
  }

  const episodesBySeries = new Map<string, JellyfinItem[]>();
  for (const episode of episodes) {
    const seriesId = episode.SeriesId || episode.Id;
    const bucket = episodesBySeries.get(seriesId) ?? [];
    bucket.push(episode);
    episodesBySeries.set(seriesId, bucket);
  }

  const pickedEpisodes: JellyfinItem[] = [];
  for (const [seriesId, candidates] of episodesBySeries) {
    const chosen = pickEpisodeForSeries(seriesId, candidates);
    if (chosen) pickedEpisodes.push(chosen);
  }

  const rank = new Map(items.map((item, index) => [item.Id, index]));
  pickedEpisodes.sort((a, b) => (rank.get(a.Id) ?? 0) - (rank.get(b.Id) ?? 0));

  const seen = new Set<string>();
  const kept: JellyfinItem[] = [];
  for (const item of [...pickedEpisodes, ...rest]) {
    const key =
      item.Type === "Episode"
        ? `series:${item.SeriesId || item.Id}`
        : item.Type === "Series"
          ? `series:${item.Id}`
          : `movie:${item.Id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }

  kept.sort((a, b) => (rank.get(a.Id) ?? 0) - (rank.get(b.Id) ?? 0));
  return kept;
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

export type FeaturedItem = JellyfinItem & { hasNewEpisodes?: boolean };

export function buildFeaturedLineup(input: {
  latest: JellyfinItem[];
  newEpisodes: JellyfinItem[];
  unplayedMovies: JellyfinItem[];
  unplayedSeries: JellyfinItem[];
  catalog: JellyfinItem[];
  tab: "home" | "movies" | "shows";
}): FeaturedItem[] {
  const { latest, newEpisodes, unplayedMovies, unplayedSeries, catalog, tab } = input;
  const seriesWithNewEps = new Set(
    newEpisodes.filter(isNewRelease).map((episode) => episode.SeriesId).filter(Boolean) as string[]
  );

  const incoming: JellyfinItem[] = [];
  if (tab !== "movies") {
    incoming.push(
      ...seriesForNewEpisodes(newEpisodes.filter(isNewRelease), catalog),
      ...unplayedSeries.filter(isNewRelease)
    );
  }
  if (tab !== "shows") {
    incoming.push(...unplayedMovies.filter(isNewRelease));
  }

  const base = latest.filter((item) => item.Type === "Series" || item.Type === "Movie" || !item.Type);
  return featuredWithNewReleases(base, incoming)
    .filter((item) => item.Type !== "Episode")
    .map((item) => ({
      ...item,
      hasNewEpisodes: item.Type === "Series" && seriesWithNewEps.has(item.Id),
    }));
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

export async function fetchMovie(_userId: string, id: string) {
  let response: Response;
  try {
    response = await fetch(`/api/item/${encodeURIComponent(id)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Could not open this title. Check that Narwhal can reach Jellyfin.");
  }
  const data = (await response.json().catch(() => null)) as (JellyfinItem & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error || "Could not open this title.");
  if (!data?.Id) throw new Error("Could not open this title.");
  return data;
}

export async function fetchSeasons(_userId: string, seriesId: string) {
  let response: Response;
  try {
    response = await fetch(`/api/series/${encodeURIComponent(seriesId)}/seasons`, {
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Could not load seasons. Check that Narwhal can reach Jellyfin.");
  }
  const data = (await response.json().catch(() => null)) as { items?: JellyfinItem[]; error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Could not load seasons.");
  return asItemList(data?.items ?? data);
}

export async function fetchEpisodes(_userId: string, seriesId: string, seasonId?: string) {
  const params = new URLSearchParams();
  if (seasonId) params.set("seasonId", seasonId);
  const query = params.toString();
  let response: Response;
  try {
    response = await fetch(
      `/api/series/${encodeURIComponent(seriesId)}/episodes${query ? `?${query}` : ""}`,
      { cache: "no-store", credentials: "same-origin" }
    );
  } catch {
    throw new Error("Could not load episodes. Check that Narwhal can reach Jellyfin.");
  }
  const data = (await response.json().catch(() => null)) as { items?: JellyfinItem[]; error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Could not load episodes.");
  return asItemList(data?.items ?? data);
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
    body: JSON.stringify({
      UserId: userId,
      MaxStreamingBitrate: 12_000_000,
      AutoOpenLiveStream: true,
      DeviceProfile: BROWSER_DEVICE_PROFILE,
    }),
  });
}

export function subtitleUrl(itemId: string, mediaSourceId: string, index: number) {
  const path = `Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${index}/Stream.vtt`;
  return `/api/jf/${path}`;
}

export function audioTracks(info: PlaybackInfo | null) {
  const source = info?.MediaSources?.[0];
  if (!source) return [];
  return (source.MediaStreams ?? [])
    .filter((stream): stream is MediaStream & { Index: number } => stream.Type === "Audio" && typeof stream.Index === "number")
    .map((stream) => ({
      index: stream.Index,
      label: stream.DisplayTitle || stream.Language || `Audio ${stream.Index}`,
      codec: stream.Codec || "",
      isDefault: Boolean(stream.IsDefault),
    }));
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

export async function savePlayPosition(userId: string, itemId: string, positionTicks: number, played = false) {
  const body = JSON.stringify({
    ItemId: itemId,
    PlaybackPositionTicks: positionTicks,
    PositionTicks: positionTicks,
    Played: played,
    IsPaused: !played,
    CanSeek: true,
  });
  const send = (path: string) =>
    fetch(`/api/jf/${path}`, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => undefined);
  await send(`Users/${encodeURIComponent(userId)}/PlayingItems/${encodeURIComponent(itemId)}`);
  await send(`Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}/UserData`);
  await send(`Sessions/Playing/${played ? "Stopped" : "Progress"}`);
  await send(`Users/${encodeURIComponent(userId)}/PlayingItems/${encodeURIComponent(itemId)}/Progress`);
}
