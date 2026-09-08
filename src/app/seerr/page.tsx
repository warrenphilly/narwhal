"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Carousel } from "@/components/carousel";
import { LoginScreen } from "@/components/login-screen";
import { SeerrPoster } from "@/components/seerr-poster";
import { SeerrRequestDialog } from "@/components/seerr-request-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/components/session-provider";
import { useSettings } from "@/components/app-settings";
import { NarwhalSpinner, PageSpinner } from "@/components/narwhal-spinner";
import { formatBytes } from "@/lib/jellyfin-types";
import {
  asDiscoverResults,
  defaultDiscoverSliders,
  downloadPercent,
  isHomeSlider,
  posterUrl,
  requestStatusLabel,
  requestTitle,
  sliderFetch,
  statusLabel,
  type DiscoverSlider,
  type SeerrDownload,
  type SeerrRequest,
  type SeerrSearchResult,
} from "@/lib/seerr";
import { cn } from "@/lib/utils";

type SessionInfo = { connected: boolean; serverUrl?: string; error?: string };
type DiscoverRow = { title: string; items: SeerrSearchResult[] };

async function seerr<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/seerr/${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data && "error" in data ? String(data.error) : "Discover request failed.");
  return data as T;
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
      rows.push({
        key: `${request.id}-${item.downloadId || item.title || rows.length}`,
        title: item.title || `Request #${request.id}`,
        item,
      });
    }
  }
  return rows;
}

async function hydrate(items: SeerrSearchResult[]) {
  const next = await Promise.all(
    items.slice(0, 28).map(async (item) => {
      if (item.posterPath && item.title) return item;
      try {
        const detail = await seerr<Record<string, unknown>>(
          `v1/${item.mediaType === "tv" ? "tv" : "movie"}/${item.id}`
        );
        return {
          ...item,
          title: item.title || String(detail.title ?? detail.name ?? ""),
          posterPath: item.posterPath || (detail.posterPath ? String(detail.posterPath) : undefined),
          releaseDate: item.releaseDate || (detail.releaseDate ? String(detail.releaseDate) : undefined),
          firstAirDate: item.firstAirDate || (detail.firstAirDate ? String(detail.firstAirDate) : undefined),
          mediaInfo: (detail.mediaInfo as SeerrSearchResult["mediaInfo"]) || item.mediaInfo,
        };
      } catch {
        return item;
      }
    })
  );
  return next;
}

function Accordion({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={onToggle}>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
        <span className="text-xs text-zinc-500">
          {count} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <div className="space-y-2 border-t border-zinc-100 px-3 py-3 dark:border-white/10">{children}</div>}
    </div>
  );
}

function SideItem({ item }: { item: SeerrSearchResult }) {
  const art = posterUrl(item.posterPath);
  return (
    <div className="flex gap-2">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.title || item.name || "Untitled"}</p>
        <p className="text-xs text-zinc-500">{statusLabel(item.mediaInfo?.status) || (item.mediaType === "tv" ? "Series" : "Movie")}</p>
      </div>
    </div>
  );
}

export default function SeerrPage() {
  const { session, loading, preview } = useSession();
  const { openSettings } = useSettings();
  const [info, setInfo] = useState<SessionInfo>({ connected: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "movie" | "tv">("all");
  const [availability, setAvailability] = useState<"all" | "new" | "library">("all");
  const [results, setResults] = useState<SeerrSearchResult[]>([]);
  const [requests, setRequests] = useState<SeerrRequest[]>([]);
  const [discover, setDiscover] = useState<DiscoverRow[]>([]);
  const [recent, setRecent] = useState<SeerrSearchResult[]>([]);
  const [recentRequests, setRecentRequests] = useState<SeerrSearchResult[]>([]);
  const [upcoming, setUpcoming] = useState<SeerrSearchResult[]>([]);
  const [ongoing, setOngoing] = useState<SeerrSearchResult[]>([]);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [pick, setPick] = useState<SeerrSearchResult | null>(null);
  const [wide, setWide] = useState(true);
  const [openPanel, setOpenPanel] = useState("downloads");

  const refreshSession = useCallback(async () => {
    const response = await fetch("/api/seerr/session", { cache: "no-store" });
    const data = (await response.json()) as SessionInfo;
    setInfo(data);
    if (!data.connected) openSettings();
  }, [openSettings]);

  const refreshDownloads = useCallback(async () => {
    if (!info.connected) return;
    try {
      const [processing, approved, pending] = await Promise.all([
        seerr<unknown>("v1/request?take=50&filter=processing&sort=added"),
        seerr<unknown>("v1/request?take=50&filter=approved&sort=added"),
        seerr<unknown>("v1/request?take=50&filter=pending&sort=added"),
      ]);
      const merged = new Map<number, SeerrRequest>();
      for (const row of [...asRequests(processing), ...asRequests(approved), ...asRequests(pending)]) {
        merged.set(row.id, row);
      }
      const list = [...merged.values()];
      const named = await Promise.all(
        list.map(async (row) => {
          if (requestTitle(row)) return row;
          const tmdbId = row.media?.tmdbId;
          const kind = String(row.media?.mediaType || row.mediaType || row.type || "movie").toLowerCase();
          if (!tmdbId) return row;
          try {
            const detail = await seerr<{ title?: string; name?: string }>(`v1/${kind === "tv" ? "tv" : "movie"}/${tmdbId}`);
            return { ...row, title: detail.title || detail.name || "" };
          } catch {
            return row;
          }
        })
      );
      setRequests(named);
    } catch {
      /* keep last list */
    }
  }, [info.connected]);

  const loadDiscover = useCallback(async () => {
    if (!info.connected) return;
    let sliders: DiscoverSlider[] = defaultDiscoverSliders();
    try {
      const data = await seerr<unknown>("v1/settings/discover");
      if (Array.isArray(data) && data.length) sliders = data as DiscoverSlider[];
    } catch {
      /* defaults */
    }
    const home = sliders.filter(isHomeSlider);
    const rows = await Promise.all(
      home.map(async (slider) => {
        const next = sliderFetch(slider);
        if (!next) return null;
        try {
          const payload = await seerr<unknown>(next.path);
          const extraPath = next.path.includes("page=1") ? next.path.replace("page=1", "page=2") : null;
          const extra = extraPath ? await seerr<unknown>(extraPath).catch(() => null) : null;
          const seen = new Set<number>();
          let items = [...asDiscoverResults(payload), ...asDiscoverResults(extra)].filter((item) => {
            if ((item.mediaType !== "movie" && item.mediaType !== "tv") || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          if (items.some((item) => !item.posterPath)) items = await hydrate(items);
          if (!items.length) return null;
          return { title: next.title, items };
        } catch {
          return null;
        }
      })
    );
    setDiscover(rows.filter((row): row is DiscoverRow => Boolean(row)));

    const [added, requested, coming] = await Promise.all([
      seerr<unknown>("v1/media?take=16&filter=allavailable&sort=mediaAdded").catch(() => null),
      seerr<unknown>("v1/request?take=16&filter=all&sort=modified").catch(() => null),
      seerr<unknown>(`v1/discover/movies?page=1&primaryReleaseDateGte=${new Date().toISOString().slice(0, 10)}`).catch(
        () => null
      ),
    ]);
    setRecent(await hydrate(asDiscoverResults(added)));
    setRecentRequests(await hydrate(asDiscoverResults(requested)));
    setUpcoming(asDiscoverResults(coming).slice(0, 12));
  }, [info.connected]);

  useEffect(() => {
    refreshSession().catch(() => undefined);
    const onUpdate = () => {
      refreshSession().catch(() => undefined);
    };
    window.addEventListener("narwhal-seerr-updated", onUpdate);
    return () => window.removeEventListener("narwhal-seerr-updated", onUpdate);
  }, [refreshSession]);

  useEffect(() => {
    if (!info.connected) return;
    refreshDownloads().catch(() => undefined);
    loadDiscover().catch(() => undefined);
    const timer = window.setInterval(() => {
      refreshDownloads().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [info.connected, refreshDownloads, loadDiscover]);

  const downloads = useMemo(() => activeDownloads(requests), [requests]);

  useEffect(() => {
    const shows = recentRequests.filter((item) => item.mediaType === "tv" && (item.mediaInfo?.status ?? 0) < 5);
    setOngoing(shows);
  }, [recentRequests]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const data = await seerr<unknown>(`v1/search?query=${encodeURIComponent(term)}&page=1`);
        setResults(asDiscoverResults(data).filter((row) => row.mediaType === "movie" || row.mediaType === "tv"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        setBusy(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  function matchesFilters(item: SeerrSearchResult) {
    if (kind !== "all" && item.mediaType !== kind) return false;
    const status = item.mediaInfo?.status ?? 0;
    if (availability === "library" && status < 5) return false;
    if (availability === "new" && status >= 2) return false;
    return true;
  }

  async function submitRequest(body: Record<string, unknown>) {
    if (!pick) return;
    setRequesting(pick.id);
    await seerr("v1/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const mark = (row: SeerrSearchResult) =>
      row.id === pick.id ? { ...row, mediaInfo: { ...row.mediaInfo, status: 2 } } : row;
    setResults((current) => current.map(mark));
    setDiscover((rows) => rows.map((row) => ({ ...row, items: row.items.map(mark) })));
    await refreshDownloads();
    setRequesting(null);
  }

  if (loading) return <PageSpinner label="Waking Narwhal…" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <div className="page-gutter py-6">
        <div className={cn("grid gap-6", wide ? "lg:grid-cols-[320px_minmax(0,1fr)]" : "lg:grid-cols-[56px_minmax(0,1fr)]")}>
          <aside className="space-y-3">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setWide((value) => !value)} aria-label={wide ? "Collapse sidebar" : "Expand sidebar"}>
              {wide ? <ChevronLeft /> : <ChevronRight />}
            </Button>
            {wide && (
              <>
                <Accordion title="Downloads" count={downloads.length} open={openPanel === "downloads"} onToggle={() => setOpenPanel(openPanel === "downloads" ? "" : "downloads")}>
                  {downloads.length === 0 && <p className="text-sm text-zinc-500">Nothing transferring.</p>}
                  {downloads.map((row) => (
                    <div key={row.key}>
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="text-xs text-zinc-500">
                        {row.item.status || "downloading"}
                        {row.item.timeLeft ? ` · ${row.item.timeLeft}` : ""}
                        {row.item.size ? ` · ${formatBytes((row.item.size ?? 0) - (row.item.sizeLeft ?? 0))} / ${formatBytes(row.item.size)}` : ""}
                      </p>
                      <Progress value={downloadPercent(row.item)} className="mt-1 h-1.5" />
                    </div>
                  ))}
                </Accordion>
                <Accordion title="Requests" count={requests.length} open={openPanel === "requests"} onToggle={() => setOpenPanel(openPanel === "requests" ? "" : "requests")}>
                  {requests.length === 0 && <p className="text-sm text-zinc-500">No open requests.</p>}
                  {requests.map((row) => (
                    <div key={row.id} className="text-sm">
                      <p className="truncate font-medium">
                        {requestTitle(row) || `Request #${row.id}`}
                        {row.is4k ? " · 4K" : ""}
                      </p>
                      <p className="text-xs text-zinc-500">{requestStatusLabel(row.status)}</p>
                    </div>
                  ))}
                </Accordion>
                <Accordion title="Recently added" count={recent.length} open={openPanel === "added"} onToggle={() => setOpenPanel(openPanel === "added" ? "" : "added")}>
                  {recent.length === 0 && <p className="text-sm text-zinc-500">Nothing new yet.</p>}
                  {recent.map((item) => (
                    <SideItem key={`added-${item.mediaType}-${item.id}`} item={item} />
                  ))}
                </Accordion>
                <Accordion title="Recently requested" count={recentRequests.length} open={openPanel === "requested"} onToggle={() => setOpenPanel(openPanel === "requested" ? "" : "requested")}>
                  {recentRequests.length === 0 && <p className="text-sm text-zinc-500">No recent requests.</p>}
                  {recentRequests.map((item) => (
                    <SideItem key={`req-${item.mediaType}-${item.id}`} item={item} />
                  ))}
                </Accordion>
                <Accordion title="Upcoming movies" count={upcoming.length} open={openPanel === "upcoming"} onToggle={() => setOpenPanel(openPanel === "upcoming" ? "" : "upcoming")}>
                  {upcoming.map((item) => (
                    <SideItem key={`up-${item.id}`} item={item} />
                  ))}
                </Accordion>
                <Accordion title="Ongoing shows" count={ongoing.length} open={openPanel === "ongoing"} onToggle={() => setOpenPanel(openPanel === "ongoing" ? "" : "ongoing")}>
                  {ongoing.map((item) => (
                    <SideItem key={`on-${item.id}`} item={item} />
                  ))}
                </Accordion>
              </>
            )}
          </aside>

          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Discover</h1>
                <p className="mt-2 text-sm text-zinc-500">Browse and request titles. Pick HD/4K and a quality profile.</p>
              </div>
            </div>
            <div className="mt-5">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search as you type"
                className="h-12"
                disabled={!info.connected}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All"],
                    ["movie", "Movies"],
                    ["tv", "TV"],
                  ] as const
                ).map(([value, label]) => (
                  <Button key={value} type="button" size="sm" className="rounded-full" variant={kind === value ? "default" : "outline"} onClick={() => setKind(value)}>
                    {label}
                  </Button>
                ))}
                {(
                  [
                    ["all", "Any status"],
                    ["new", "Not requested"],
                    ["library", "Already in library"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    className="rounded-full"
                    variant={availability === value ? "default" : "outline"}
                    onClick={() => setAvailability(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {busy && query.trim() && <p className="mt-3 text-sm text-zinc-500">Searching…</p>}

            {results.length > 0 && (
              <section className="mt-8 space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Search results</h2>
                <Carousel itemGap="gap-6">
                  {results.filter(matchesFilters).map((item) => (
                    <SeerrPoster
                      key={`search-${item.mediaType}-${item.id}`}
                      item={item}
                      requesting={requesting === item.id}
                      onRequest={setPick}
                    />
                  ))}
                </Carousel>
              </section>
            )}

            <div className="mt-8 space-y-10">
              {info.connected && discover.length === 0 && !busy && (
                <NarwhalSpinner label="Loading Discover…" />
              )}
              {discover.map((row) => {
                const items = row.items.filter(matchesFilters);
                if (!items.length) return null;
                return (
                  <section key={row.title} className="space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">{row.title}</h2>
                    <Carousel itemGap="gap-6">
                      {items.map((item) => (
                        <SeerrPoster
                          key={`${row.title}-${item.mediaType}-${item.id}`}
                          item={item}
                          requesting={requesting === item.id}
                          onRequest={setPick}
                        />
                      ))}
                    </Carousel>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <SeerrRequestDialog item={pick} open={Boolean(pick)} onOpenChange={(open) => !open && setPick(null)} onSubmit={submitRequest} />
    </AppShell>
  );
}
