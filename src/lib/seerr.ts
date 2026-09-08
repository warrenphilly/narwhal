import { cookies } from "next/headers";
import { normalizeServerUrl } from "@/lib/session";

export const SEERR_COOKIE = "seerr_session";

export type SeerrSession = {
  serverUrl: string;
  apiKey: string;
  allowInsecure?: boolean;
};

export function normalizeSeerrUrl(input: string) {
  return normalizeServerUrl(input);
}

export function seerrCookieValue(session: SeerrSession) {
  return JSON.stringify(session);
}

export async function getSeerrSession(): Promise<SeerrSession | null> {
  const store = await cookies();
  const raw = store.get(SEERR_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SeerrSession;
    if (!parsed.serverUrl || !parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
  media?: SeerrMediaInfo & { tmdbId?: number };
  mediaType?: string;
  seasons?: { seasonNumber?: number }[];
};

export function posterUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
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
