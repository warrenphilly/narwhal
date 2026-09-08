import type { JellyfinItem } from "@/lib/jellyfin-types";

export function titlePageHref(item: JellyfinItem) {
  if (item.Type === "Series") return `/show/${item.Id}`;
  if (item.Type === "Episode" && item.SeriesId) return `/show/${item.SeriesId}`;
  return `/movie/${item.Id}`;
}

export function playHref(item: JellyfinItem) {
  if (item.Type === "Series") return `/show/${item.Id}`;
  return `/watch/${item.Id}`;
}

export function playerTitleHref(item: JellyfinItem) {
  if (item.SeriesId) return `/show/${item.SeriesId}`;
  if (item.Type === "Series") return `/show/${item.Id}`;
  return `/movie/${item.Id}`;
}
