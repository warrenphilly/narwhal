import type { JellyfinItem, JellyfinItemsResult } from "@/lib/jellyfin-types";

const ITEM_FIELDS =
  "Overview,Genres,PrimaryImageAspectRatio,MediaSources,CanDownload,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData";

async function jf<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/jf/${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || `Jellyfin request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function imageUrl(itemId: string, options?: { type?: string; maxWidth?: number; maxHeight?: number; tag?: string }) {
  const type = options?.type ?? "Primary";
  const params = new URLSearchParams();
  if (options?.maxWidth) params.set("maxWidth", String(options.maxWidth));
  if (options?.maxHeight) params.set("maxHeight", String(options.maxHeight));
  if (options?.tag) params.set("tag", options.tag);
  params.set("quality", "90");
  return `/api/jf/Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`;
}

export function streamUrl(itemId: string) {
  return `/api/jf/Videos/${encodeURIComponent(itemId)}/stream?static=true`;
}

export async function fetchMovies(userId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=Movie&Recursive=true&SortBy=SortName&SortOrder=Ascending&Fields=${ITEM_FIELDS}&Limit=200`
  );
  return data.Items ?? [];
}

export async function fetchResume(userId: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items/Resume?MediaTypes=Video&Fields=${ITEM_FIELDS}&Limit=24`
  );
  return (data.Items ?? []).filter((item) => item.Type === "Movie" || !item.Type);
}

export async function fetchLatest(userId: string) {
  const items = await jf<JellyfinItem[]>(
    `Users/${encodeURIComponent(userId)}/Items/Latest?IncludeItemTypes=Movie&Limit=24&Fields=${ITEM_FIELDS}`
  );
  return Array.isArray(items) ? items : [];
}

export async function fetchMovie(userId: string, id: string) {
  return jf<JellyfinItem>(
    `Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}?Fields=${ITEM_FIELDS}`
  );
}

export async function searchMovies(userId: string, query: string) {
  const data = await jf<JellyfinItemsResult>(
    `Users/${encodeURIComponent(userId)}/Items?SearchTerm=${encodeURIComponent(query)}&IncludeItemTypes=Movie&Recursive=true&Fields=${ITEM_FIELDS}&Limit=40`
  );
  return data.Items ?? [];
}

export async function reportPlaybackStart(itemId: string) {
  await fetch("/api/jf/Sessions/Playing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ItemId: itemId, PlayMethod: "DirectPlay" }),
  }).catch(() => undefined);
}
