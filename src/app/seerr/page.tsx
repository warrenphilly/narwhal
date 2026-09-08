"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/components/session-provider";
import { formatBytes } from "@/lib/jellyfin-types";
import {
  downloadPercent,
  posterUrl,
  statusLabel,
  type SeerrDownload,
  type SeerrRequest,
  type SeerrSearchResult,
} from "@/lib/seerr";
import { cn } from "@/lib/utils";

type SessionInfo = { connected: boolean; serverUrl?: string; error?: string };

async function seerr<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/seerr/${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data && "error" in data ? data.error : "Seerr request failed.");
  return data as T;
}

function asResults(data: unknown): SeerrSearchResult[] {
  if (Array.isArray(data)) return data as SeerrSearchResult[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: SeerrSearchResult[] }).results;
  }
  return [];
}

function asRequests(data: unknown): SeerrRequest[] {
  if (Array.isArray(data)) return data as SeerrRequest[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: SeerrRequest[] }).results;
  }
  return [];
}

function activeDownloads(requests: SeerrRequest[]) {
  const rows: { key: string; title: string; item: SeerrDownload }[] = [];
  for (const request of requests) {
    const media = request.media;
    const items = [...(media?.downloadStatus ?? []), ...(media?.downloadStatus4k ?? [])];
    for (const item of items) {
      const title = item.title || `Request #${request.id}`;
      rows.push({
        key: `${request.id}-${item.downloadId || item.title || rows.length}`,
        title,
        item,
      });
    }
  }
  return rows;
}

export default function SeerrPage() {
  const { session, loading, preview } = useSession();
  const [info, setInfo] = useState<SessionInfo>({ connected: false });
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SeerrSearchResult[]>([]);
  const [requests, setRequests] = useState<SeerrRequest[]>([]);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [openDownloads, setOpenDownloads] = useState(true);

  const refreshSession = useCallback(async () => {
    const response = await fetch("/api/seerr/session", { cache: "no-store" });
    const data = (await response.json()) as SessionInfo;
    setInfo(data);
    if (data.serverUrl) setServerUrl(data.serverUrl);
  }, []);

  const refreshDownloads = useCallback(async () => {
    if (!info.connected) return;
    try {
      const [processing, approved] = await Promise.all([
        seerr<unknown>("v1/request?take=50&filter=processing&sort=added"),
        seerr<unknown>("v1/request?take=50&filter=approved&sort=added"),
      ]);
      const merged = new Map<number, SeerrRequest>();
      for (const row of [...asRequests(processing), ...asRequests(approved)]) {
        merged.set(row.id, row);
      }
      setRequests([...merged.values()]);
    } catch {
      /* keep last list */
    }
  }, [info.connected]);

  useEffect(() => {
    refreshSession().catch(() => undefined);
  }, [refreshSession]);

  useEffect(() => {
    if (!info.connected) return;
    refreshDownloads().catch(() => undefined);
    const timer = window.setInterval(() => {
      refreshDownloads().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [info.connected, refreshDownloads]);

  const downloads = useMemo(() => activeDownloads(requests), [requests]);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/seerr/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, apiKey, allowInsecure }),
      });
      const data = (await response.json()) as SessionInfo;
      if (!response.ok) throw new Error(data.error || "Could not connect.");
      setApiKey("");
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setBusy(true);
    setError(null);
    try {
      const data = await seerr<unknown>(`v1/search?query=${encodeURIComponent(term)}&page=1`);
      setResults(asResults(data).filter((row) => row.mediaType === "movie" || row.mediaType === "tv"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestTitle(item: SeerrSearchResult) {
    setRequesting(item.id);
    setError(null);
    try {
      const body =
        item.mediaType === "tv"
          ? { mediaType: "tv", mediaId: item.id, seasons: "all" }
          : { mediaType: "movie", mediaId: item.id };
      await seerr("v1/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResults((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, mediaInfo: { ...row.mediaInfo, status: 2 } }
            : row
        )
      );
      await refreshDownloads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setRequesting(null);
    }
  }

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <div className="page-gutter py-6">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <form onSubmit={connect} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
              <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">Seerr</p>
              <div className="space-y-1.5">
                <Label htmlFor="seerr-url">Server address</Label>
                <Input
                  id="seerr-url"
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="http://192.168.x.x:5055"
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seerr-key">API key</Label>
                <Input
                  id="seerr-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={info.connected ? "Saved — paste to replace" : "Settings → General"}
                  className="h-10"
                  required={!info.connected}
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-zinc-500">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={allowInsecure}
                  onChange={(event) => setAllowInsecure(event.target.checked)}
                />
                Allow self-signed HTTPS
              </label>
              <Button type="submit" disabled={busy} className="h-10 w-full rounded-full">
                {busy ? "Connecting…" : info.connected ? "Update connection" : "Connect"}
              </Button>
              {info.connected && (
                <p className="text-xs text-zinc-500">Connected to {info.serverUrl}</p>
              )}
            </form>

            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setOpenDownloads((open) => !open)}
                aria-expanded={openDownloads}
              >
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Active downloads
                </span>
                <span className="text-xs text-zinc-500">
                  {downloads.length} {openDownloads ? "▾" : "▸"}
                </span>
              </button>
              {openDownloads && (
                <div className="space-y-3 border-t border-zinc-100 px-4 py-3 dark:border-white/10">
                  {!info.connected && (
                    <p className="text-sm text-zinc-500">Connect Seerr to watch Radarr/Sonarr jobs.</p>
                  )}
                  {info.connected && downloads.length === 0 && (
                    <p className="text-sm text-zinc-500">Nothing transferring right now.</p>
                  )}
                  {downloads.map((row) => {
                    const pct = downloadPercent(row.item);
                    return (
                      <div key={row.key}>
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{row.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {row.item.status || "downloading"}
                          {row.item.timeLeft ? ` · ${row.item.timeLeft} left` : ""}
                          {row.item.size ? ` · ${formatBytes((row.item.size ?? 0) - (row.item.sizeLeft ?? 0))} / ${formatBytes(row.item.size)}` : ""}
                        </p>
                        <Progress value={pct} className="mt-2 h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Request titles</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Search Seerr, send a request, then watch the transfer on the left. Get the API key in Seerr → Settings → General.
            </p>
            <form onSubmit={search} className="mt-5 flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies and TV"
                className="h-11"
                disabled={!info.connected}
              />
              <Button type="submit" disabled={!info.connected || busy} className="h-11 rounded-full px-5">
                Search
              </Button>
            </form>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {results.map((item) => {
                const title = item.title || item.name || "Untitled";
                const year = (item.releaseDate || item.firstAirDate || "").slice(0, 4);
                const status = statusLabel(item.mediaInfo?.status);
                const canRequest = !item.mediaInfo?.status || item.mediaInfo.status < 2;
                return (
                  <article
                    key={`${item.mediaType}-${item.id}`}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900"
                  >
                    <div className="aspect-[2/3] bg-zinc-200 dark:bg-zinc-800">
                      {posterUrl(item.posterPath) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterUrl(item.posterPath)} alt="" className="size-full object-cover" />
                      ) : null}
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {title}
                        {year ? ` (${year})` : ""}
                      </p>
                      <p className="text-xs text-zinc-500">{item.mediaType === "tv" ? "TV" : "Movie"}</p>
                      {status ? (
                        <p className={cn("text-xs", item.mediaInfo?.status === 5 ? "text-emerald-600" : "text-sky-600")}>
                          {status}
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 w-full rounded-full"
                          disabled={requesting === item.id || !canRequest}
                          onClick={() => requestTitle(item)}
                        >
                          {requesting === item.id ? "Requesting…" : "Request"}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
