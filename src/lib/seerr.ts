export const MEDIA_STATUS = {
  unknown: 1,
  pending: 2,
  processing: 3,
  partial: 4,
  available: 5,
} as const;

export type SeerrDownload = {
  downloadId?: string;
  title?: string;
  size?: number;
  sizeLeft?: number;
  status?: string;
  timeLeft?: string;
  estimatedCompletionTime?: string;
  episode?: string;
};

export type SeerrMediaInfo = {
  status?: number;
  mediaType?: string;
  downloadStatus?: SeerrDownload[];
  downloadStatus4k?: SeerrDownload[];
};

export type SeerrSearchResult = {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  mediaInfo?: SeerrMediaInfo;
};

export type SeerrRequest = {
  id: number;
  status?: number;
  type?: string;
  is4k?: boolean;
  createdAt?: string;
  title?: string;
  name?: string;
  media?: SeerrMediaInfo & { tmdbId?: number; mediaType?: string; title?: string; name?: string };
  mediaType?: string;
  seasons?: { seasonNumber?: number }[];
};

export function requestTitle(row: SeerrRequest) {
  return (
    row.title ||
    row.name ||
    row.media?.title ||
    row.media?.name ||
    ""
  );
}

export type SeerrService = {
  id: number;
  name?: string;
  is4k?: boolean;
  isDefault?: boolean;
  activeProfileId?: number;
  profiles?: { id: number; name?: string }[];
  externalUrl?: string;
};

export type SeerrSeason = {
  seasonNumber: number;
  name?: string;
  episodeCount?: number;
};

export type SeerrEpisode = {
  id?: number;
  name?: string;
  overview?: string;
  airDate?: string | null;
  episodeNumber: number;
  seasonNumber: number;
  stillPath?: string;
};

export type SeerrSeasonDetail = {
  seasonNumber: number;
  name?: string;
  overview?: string;
  episodes?: SeerrEpisode[];
};

export const REQUEST_STATUS = {
  pending: 1,
  approved: 2,
  declined: 3,
  failed: 4,
} as const;

export function requestStatusLabel(status?: number) {
  if (status === REQUEST_STATUS.pending) return "Pending";
  if (status === REQUEST_STATUS.approved) return "Approved";
  if (status === REQUEST_STATUS.declined) return "Declined";
  if (status === REQUEST_STATUS.failed) return "Failed";
  return "Requested";
}

export function posterUrl(path?: string, size = "w342") {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function backdropUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w1280${path}`;
}

const RELEASE_TYPES: Record<number, string> = {
  1: "Premiere",
  2: "Limited theatrical",
  3: "Theatrical",
  4: "Digital",
  5: "Physical",
  6: "TV",
};

export function releaseTypeLabel(type?: number) {
  return type ? RELEASE_TYPES[type] || `Release ${type}` : "";
}

export function formatMinutes(mins?: number) {
  if (!mins) return "";
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (!hours) return `${rest}m`;
  return `${hours}h ${rest}m`;
}

export function downloadPercent(item: SeerrDownload) {
  const size = item.size ?? 0;
  const left = item.sizeLeft ?? 0;
  if (!size) return item.status === "completed" ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((size - left) / size) * 100)));
}

export function statusLabel(status?: number) {
  if (status === MEDIA_STATUS.available) return "Available";
  if (status === MEDIA_STATUS.partial) return "Partly available";
  if (status === MEDIA_STATUS.processing) return "Downloading";
  if (status === MEDIA_STATUS.pending) return "Requested";
  return "";
}

export type DiscoverSlider = {
  id?: number;
  type: number;
  title?: string | null;
  enabled?: boolean;
  data?: string | null;
  order?: number;
};

const SLIDER = {
  recentlyAdded: 1,
  recentRequests: 2,
  watchlist: 3,
  trending: 4,
  popularMovies: 5,
  upcomingMovies: 7,
  popularTv: 9,
  upcomingTv: 11,
  movieKeyword: 13,
  movieGenre: 14,
  tvKeyword: 15,
  tvGenre: 16,
  search: 17,
  studio: 18,
  network: 19,
  movieStream: 20,
  tvStream: 21,
} as const;

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultDiscoverSliders(): DiscoverSlider[] {
  return [
    { type: SLIDER.trending, title: "Trending", enabled: true },
    { type: SLIDER.popularMovies, title: "Popular Movies", enabled: true },
    { type: SLIDER.popularTv, title: "Popular Series", enabled: true },
    { type: SLIDER.upcomingMovies, title: "Upcoming Movies", enabled: true },
    { type: SLIDER.upcomingTv, title: "Upcoming Series", enabled: true },
    { type: SLIDER.movieGenre, title: "Action movies", enabled: true, data: "28" },
    { type: SLIDER.movieGenre, title: "Comedy movies", enabled: true, data: "35" },
    { type: SLIDER.tvGenre, title: "Drama series", enabled: true, data: "18" },
  ];
}

export function isHomeSlider(slider: DiscoverSlider) {
  return slider.type !== SLIDER.recentlyAdded && slider.type !== SLIDER.recentRequests;
}

export function sliderFetch(slider: DiscoverSlider): { title: string; path: string } | null {
  if (slider.enabled === false) return null;
  const data = slider.data ? encodeURIComponent(slider.data) : "";
  const title = slider.title?.trim() || "";
  switch (slider.type) {
    case SLIDER.recentlyAdded:
      return { title: title || "Recently Added", path: "v1/media?take=20&filter=allavailable&sort=mediaAdded" };
    case SLIDER.recentRequests:
      return { title: title || "Recent Requests", path: "v1/request?take=20&filter=all&sort=modified" };
    case SLIDER.watchlist:
      return { title: title || "Watchlist", path: "v1/discover/watchlist?page=1" };
    case SLIDER.trending:
      return { title: title || "Trending", path: "v1/discover/trending?page=1" };
    case SLIDER.popularMovies:
      return { title: title || "Popular Movies", path: "v1/discover/movies?page=1" };
    case SLIDER.upcomingMovies:
      return { title: title || "Upcoming Movies", path: `v1/discover/movies?page=1&primaryReleaseDateGte=${todayStamp()}` };
    case SLIDER.popularTv:
      return { title: title || "Popular Series", path: "v1/discover/tv?page=1" };
    case SLIDER.upcomingTv:
      return { title: title || "Upcoming Series", path: `v1/discover/tv?page=1&firstAirDateGte=${todayStamp()}` };
    case SLIDER.movieKeyword:
      return { title: title || "Movies", path: `v1/discover/movies?page=1&keywords=${data}` };
    case SLIDER.movieGenre:
      return { title: title || "Movies", path: `v1/discover/movies?page=1&genre=${data}` };
    case SLIDER.tvKeyword:
      return { title: title || "Series", path: `v1/discover/tv?page=1&keywords=${data}` };
    case SLIDER.tvGenre:
      return { title: title || "Series", path: `v1/discover/tv?page=1&genre=${data}` };
    case SLIDER.search:
      return { title: title || "Search", path: `v1/search?query=${data}&page=1` };
    case SLIDER.studio:
      return { title: title || "Studio", path: `v1/discover/movies/studio/${slider.data}` };
    case SLIDER.network:
      return { title: title || "Network", path: `v1/discover/tv/network/${slider.data}` };
    case SLIDER.movieStream:
      return { title: title || "Streaming", path: `v1/discover/movies?page=1&watchProviders=${data}` };
    case SLIDER.tvStream:
      return { title: title || "Streaming", path: `v1/discover/tv?page=1&watchProviders=${data}` };
    default:
      return null;
  }
}

export function asDiscoverResults(data: unknown): SeerrSearchResult[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.flatMap((row) => normalizeDiscoverItem(row) ? [normalizeDiscoverItem(row)!] : []);
  const obj = data as { results?: unknown[]; Items?: unknown[]; items?: unknown[] };
  const list = obj.results ?? obj.Items ?? obj.items;
  if (!Array.isArray(list)) return [];
  return list.flatMap((row) => {
    const item = normalizeDiscoverItem(row);
    return item ? [item] : [];
  });
}

function normalizeDiscoverItem(row: unknown): SeerrSearchResult | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const nested = item.media && typeof item.media === "object" ? (item.media as Record<string, unknown>) : item;
  const id = Number(nested.tmdbId ?? item.tmdbId ?? item.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const kind = String(nested.mediaType ?? item.mediaType ?? item.type ?? "movie").toLowerCase();
  const mediaType = kind === "tv" ? "tv" : "movie";
  return {
    id,
    mediaType,
    title: String(item.title ?? nested.title ?? item.name ?? nested.name ?? ""),
    name: item.name ? String(item.name) : undefined,
    overview: item.overview ? String(item.overview) : undefined,
    posterPath: (item.posterPath ?? nested.posterPath ?? item.poster ?? nested.poster ?? item.image)
      ? String(item.posterPath ?? nested.posterPath ?? item.poster ?? nested.poster ?? item.image)
      : undefined,
    releaseDate: item.releaseDate ? String(item.releaseDate) : undefined,
    firstAirDate: item.firstAirDate ? String(item.firstAirDate) : undefined,
    mediaInfo: (item.mediaInfo ?? nested) as SeerrMediaInfo,
  };
}
