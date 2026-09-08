import type { JellyfinItem } from "@/lib/jellyfin-types";

export function titlePageHref(item: JellyfinItem) {
  if (item.Type === "Series") return `/show/${item.Id}`;
  if (item.Type === "Episode" && item.SeriesId) return `/show/${item.SeriesId}`;
  return `/movie/${item.Id}`;
}

export function playHref(item: JellyfinItem) {
  const type = (item.Type || "").toLowerCase();
  if (type === "series" || type === "season") {
    return `/show/${item.SeriesId || item.Id}`;
  }
  if (type === "episode" || type === "movie" || type === "video") {
    return `/watch/${item.Id}`;
  }
  return titlePageHref(item);
}

export function playerTitleHref(item: JellyfinItem) {
  if (item.SeriesId) return `/show/${item.SeriesId}`;
  if (item.Type === "Series") return `/show/${item.Id}`;
  return `/movie/${item.Id}`;
}
