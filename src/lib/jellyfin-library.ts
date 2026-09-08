import type { JellyfinItem, JellyfinItemsResult } from "@/lib/jellyfin-types";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";
import { authHeader, type JellyfinSession } from "@/lib/session";

const FIELDS =
  "Genres,ProductionYear,DateCreated,PremiereDate,CommunityRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,ChildCount,CollectionType";

function normalizeItem(row: unknown): JellyfinItem | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const id = item.Id ?? item.id;
  if (!id) return null;
  return {
    ...(item as JellyfinItem),
    Id: String(id),
    Name: String(item.Name ?? item.name ?? "Untitled"),
    Type: item.Type ? String(item.Type) : undefined,
    CollectionType: item.CollectionType ? String(item.CollectionType) : undefined,
    SeriesId: item.SeriesId ? String(item.SeriesId) : undefined,
    SeriesName: item.SeriesName ? String(item.SeriesName) : undefined,
  };
}

export function asItemList(data: unknown): JellyfinItem[] {
  if (Array.isArray(data)) {
    return data.map(normalizeItem).filter((row): row is JellyfinItem => Boolean(row));
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const items = obj.Items ?? obj.items;
    if (Array.isArray(items)) {
      return items.map(normalizeItem).filter((row): row is JellyfinItem => Boolean(row));
    }
  }
  return [];
}

async function jfJson(session: JellyfinSession, path: string, timeoutMs = 30_000) {
  const url = `${session.serverUrl}/${path}`;
  const response = await jellyfinFetch(
    url,
    {
      method: "GET",
      headers: { Authorization: authHeader(session) },
    },
    { ...tunnelFromSession(session), timeoutMs }
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Jellyfin ${response.status} for ${path}: ${text.slice(0, 160)}`);
  }
  if (!text) return { data: null as unknown, text: "" };
  try {
    return { data: JSON.parse(text) as unknown, text };
  } catch {
    throw new Error(`Jellyfin sent non-JSON from ${path}: ${text.slice(0, 160)}`);
  }
}

function matchesType(item: JellyfinItem, itemType: "Movie" | "Series") {
  const type = (item.Type || "").toLowerCase();
  if (itemType === "Movie") return type === "movie" || type === "video";
  return type === "series" || type === "season" && Boolean(item.SeriesId);
}

export type LibraryPayload = {
  items: JellyfinItem[];
  views: { id: string; name: string; collectionType?: string }[];
  serverUrl: string;
  totalRecordCount?: number;
};

export async function loadLibrary(session: JellyfinSession, itemType: "Movie" | "Series"): Promise<LibraryPayload> {
  const viewsRaw = await jfJson(session, `Users/${encodeURIComponent(session.userId)}/Views`).catch(() => ({
    data: { Items: [] },
    text: "",
  }));
  const views = asItemList(viewsRaw.data).map((view) => ({
    id: view.Id,
    name: view.Name,
    collectionType: view.CollectionType,
  }));

  const queries = [
    `Users/${encodeURIComponent(session.userId)}/Items?IncludeItemTypes=${itemType}&Recursive=true&SortBy=SortName&Fields=${FIELDS}&Limit=500`,
    `Items?UserId=${encodeURIComponent(session.userId)}&IncludeItemTypes=${itemType}&Recursive=true&SortBy=SortName&Fields=${FIELDS}&Limit=500`,
    `Users/${encodeURIComponent(session.userId)}/Items?Recursive=true&SortBy=SortName&Fields=${FIELDS}&Limit=500`,
  ];

  let totalRecordCount: number | undefined;
  const collected: JellyfinItem[] = [];

  for (const path of queries) {
    const { data } = await jfJson(session, path).catch(() => ({ data: null }));
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const total = (data as JellyfinItemsResult).TotalRecordCount;
      if (typeof total === "number") totalRecordCount = total;
    }
    collected.push(...asItemList(data));
    if (collected.some((item) => matchesType(item, itemType))) break;
  }

  if (!collected.some((item) => matchesType(item, itemType))) {
    for (const view of views) {
      const { data } = await jfJson(
        session,
        `Users/${encodeURIComponent(session.userId)}/Items?ParentId=${encodeURIComponent(view.id)}&Recursive=true&SortBy=SortName&Fields=${FIELDS}&Limit=500`
      ).catch(() => ({ data: null }));
      collected.push(...asItemList(data));
    }
  }

  const seen = new Set<string>();
  const items = collected.filter((item) => {
    if (!matchesType(item, itemType)) return false;
    if (itemType === "Series" && item.Type === "Season") return false;
    if (seen.has(item.Id)) return false;
    seen.add(item.Id);
    return true;
  });

  return {
    items,
    views,
    serverUrl: session.serverUrl,
    totalRecordCount,
  };
}

function byIndex(a: JellyfinItem, b: JellyfinItem) {
  return (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0);
}

export async function loadSeasons(session: JellyfinSession, seriesId: string) {
  const user = encodeURIComponent(session.userId);
  const id = encodeURIComponent(seriesId);
  const paths = [
    `Shows/${id}/Seasons?UserId=${user}&Fields=${FIELDS}`,
    `Users/${user}/Items?ParentId=${id}&IncludeItemTypes=Season&Recursive=false&Fields=${FIELDS}&Limit=50`,
    `Users/${user}/Items?ParentId=${id}&Recursive=false&Fields=${FIELDS}&Limit=50`,
  ];
  for (const path of paths) {
    const { data } = await jfJson(session, path, 8_000).catch(() => ({ data: null }));
    const items = asItemList(data).filter((item) => {
      if (item.Id === seriesId) return false;
      const type = (item.Type || "Season").toLowerCase();
      return type === "season" || type === "folder" || type === "seasonfolder";
    });
    if (items.length) return items.sort(byIndex);
  }
  return [];
}

export async function loadEpisodes(session: JellyfinSession, seriesId: string, seasonId?: string) {
  const user = encodeURIComponent(session.userId);
  const series = encodeURIComponent(seriesId);
  const paths: string[] = [];
  if (seasonId) {
    const season = encodeURIComponent(seasonId);
    paths.push(
      `Shows/${series}/Episodes?UserId=${user}&SeasonId=${season}&Fields=${FIELDS}&Limit=200`,
      `Users/${user}/Items?ParentId=${season}&Recursive=true&Fields=${FIELDS}&Limit=200`
    );
  }
  paths.push(
    `Shows/${series}/Episodes?UserId=${user}&Fields=${FIELDS}&Limit=200`,
    `Users/${user}/Items?ParentId=${series}&IncludeItemTypes=Episode&Recursive=true&Fields=${FIELDS}&Limit=200`
  );
  for (const path of paths) {
    const { data } = await jfJson(session, path, 8_000).catch(() => ({ data: null }));
    const items = asItemList(data).filter((item) => {
      const type = (item.Type || "Episode").toLowerCase();
      return type === "episode" || type === "video" || Boolean(item.IndexNumber && type !== "season");
    });
    if (items.length) return items.sort(byIndex);
  }
  return [];
}
