import type { JellyfinItem } from "@/lib/jellyfin-types";
import type { MediaTab } from "@/lib/media-tab";

export type HomeSnap = {
  resume: JellyfinItem[];
  latest: JellyfinItem[];
  extraLatest: JellyfinItem[];
  unplayed: JellyfinItem[];
  unplayedMovies: JellyfinItem[];
  unplayedEpisodes: JellyfinItem[];
  extraUnplayed: JellyfinItem[];
  catalog: JellyfinItem[];
  viewNames: string[];
};

const homeCache = new Map<string, HomeSnap>();

export function homeCacheKey(userId: string, tab: MediaTab) {
  return `${userId}:${tab}`;
}

export function getHomeCache(key: string) {
  return homeCache.get(key);
}

export function setHomeCache(key: string, snap: HomeSnap) {
  homeCache.set(key, snap);
}

export function clearHomeCache() {
  homeCache.clear();
}
