"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { HeroBanner } from "@/components/hero-banner";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { PageRefreshButton, REFRESH_EVENT } from "@/components/page-refresh";
import { Shelf } from "@/components/shelf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { useProfiles } from "@/components/profile-provider";
import {
  buildFeaturedLineup,
  fetchLatest,
  fetchLibraryStatus,
  fetchMovies,
  fetchResume,
  fetchShows,
  fetchUnplayedRecent,
  fetchViews,
  isNewRelease,
  uniqueItems,
  uniqueContinueItems,
} from "@/lib/client-api";
import { DEMO_MOVIES, DEMO_SHOWS } from "@/lib/demo-library";
import {
  addGroup,
  collectGroupNames,
  defaultGroup,
  groupItems,
  loadGroups,
  moveGroup,
  moveItem,
  removeGroup,
  saveGroups,
  type GroupStore,
} from "@/lib/library-groups";
import { rememberTab, type MediaTab } from "@/lib/media-tab";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import {
  clearHomeCache,
  getHomeCache,
  homeCacheKey,
  setHomeCache,
  type HomeSnap,
} from "@/lib/home-cache";

export { clearHomeCache };

export function LibraryHome({ kind }: { kind: MediaTab }) {
  const { session } = useSession();
  const tab = kind;
  useEffect(() => {
    rememberTab(tab);
  }, [tab]);
  const signedIn = Boolean(session?.signedIn && session.userId);
  const cached = signedIn && session?.userId ? getHomeCache(homeCacheKey(session.userId, tab)) : undefined;
  const [snap, setSnap] = useState<HomeSnap | undefined>(cached);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(cached));
  const [reloadKey, setReloadKey] = useState(0);
  const [groups, setGroups] = useState<GroupStore>({ order: [], extra: [], assign: {} });
  const [organize, setOrganize] = useState(false);
  const [moving, setMoving] = useState<JellyfinItem | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unwatched" | "new">("all");
  const [libraryHint, setLibraryHint] = useState<string | null>(null);

  useEffect(() => {
    function onRefresh() {
      setLoaded(false);
      setReloadKey((value) => value + 1);
    }
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, []);

  // First boot sometimes hangs on the spinner — soft-retry once after a few seconds.
  useEffect(() => {
    if (!signedIn || loaded) return;
    const flag = `narwhal-auto-refresh:${tab}`;
    if (window.sessionStorage.getItem(flag) === "1") return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(flag, "1");
      clearHomeCache();
      setReloadKey((value) => value + 1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [signedIn, loaded, tab]);

  useEffect(() => {
    if (!signedIn || !session?.userId) return;
    let cancelled = false;
    const userId = session.userId;
    const key = homeCacheKey(userId, tab);
    const existing = reloadKey === 0 ? getHomeCache(key) : undefined;
    if (existing) {
      setSnap(existing);
      setLoaded(true);
    } else {
      setLoaded(false);
    }

    const mixed = tab === "home";
    const movieOnly = tab === "movies";

    (async () => {
      try {
        const { ensureServerSession } = await import("@/lib/api-session");
        await ensureServerSession();
        if (cancelled) return;
        const [
          resume,
          latestMovies,
          latestShows,
          extraLatest,
          unplayedMovies,
          unplayedEpisodes,
          extraUnplayed,
          movies,
          shows,
          views,
        ] = await Promise.all([
          fetchResume(userId).catch(() => [] as JellyfinItem[]),
          movieOnly || mixed ? fetchLatest(userId, "Movie").catch(() => [] as JellyfinItem[]) : Promise.resolve([] as JellyfinItem[]),
          !movieOnly ? fetchLatest(userId, "Series").catch(() => [] as JellyfinItem[]) : Promise.resolve([] as JellyfinItem[]),
          !movieOnly ? fetchLatest(userId, "Episode").catch(() => [] as JellyfinItem[]) : Promise.resolve([] as JellyfinItem[]),
          movieOnly || mixed ? fetchUnplayedRecent(userId, "Movie").catch(() => [] as JellyfinItem[]) : Promise.resolve([] as JellyfinItem[]),
          !movieOnly ? fetchUnplayedRecent(userId, "Episode").catch(() => [] as JellyfinItem[]) : Promise.resolve([] as JellyfinItem[]),
          !movieOnly ? fetchUnplayedRecent(userId, "Series").catch(() => [] as JellyfinItem[]) : Promise.resolve([] as JellyfinItem[]),
          movieOnly || mixed ? fetchMovies(userId) : Promise.resolve([] as JellyfinItem[]),
          !movieOnly ? fetchShows(userId) : Promise.resolve([] as JellyfinItem[]),
          fetchViews(userId),
        ]);
        if (cancelled) return;
        const next: HomeSnap = {
          resume,
          latest: uniqueItems([...latestMovies, ...latestShows]),
          extraLatest,
          unplayed: uniqueItems([...unplayedMovies, ...unplayedEpisodes]),
          unplayedMovies,
          unplayedEpisodes,
          extraUnplayed,
          catalog: uniqueItems([...movies, ...shows]),
          viewNames: views.map((view) => view.Name).filter(Boolean),
        };
        setHomeCache(key, next);
        setSnap(next);
        setError(null);
        if (next.catalog.length === 0) {
          fetchLibraryStatus()
            .then((status) => {
              if (cancelled) return;
              const libs = status.views?.libraries?.map((row) => row.name || row.collectionType || "Library").filter(Boolean) ?? [];
              const enableAll = status.policy?.enableAllFolders;
              const enabled = status.policy?.enabledFolders ?? [];
              if (status.views?.status === 401 || status.views?.status === 403) {
                setLibraryHint(`Jellyfin blocked library access (HTTP ${status.views.status}). Sign out and sign in again.`);
              } else if (enableAll === false && enabled.length === 0) {
                setLibraryHint(
                  "Jellyfin user policy has no folders enabled. In Jellyfin Web → Dashboard → Users → enable library access → Save, then sign out/in here."
                );
              } else if (libs.length) {
                setLibraryHint(
                  `Libraries seen: ${libs.join(", ")}. Movies total ${status.movies?.total ?? 0}, shows total ${status.series?.total ?? 0}.`
                );
              } else {
                setLibraryHint(
                  `Jellyfin answered Views=${status.views?.status ?? "?"} with ${status.views?.count ?? 0} libraries, movies=${status.movies?.total ?? 0}, shows=${status.series?.total ?? 0}.`
                );
              }
            })
            .catch(() => {
              if (!cancelled) setLibraryHint(null);
            });
        } else {
          setLibraryHint(null);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your library.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, session?.userId, tab, reloadKey]);

  useEffect(() => {
    if (!session?.userId) return;
    setGroups(loadGroups(session.userId, tab));
  }, [session?.userId, tab]);

  const { applyProfile, listedItems, profile } = useProfiles();
  const resume = (snap?.resume ?? []).map(applyProfile);
  const latest = (snap?.latest ?? []).map(applyProfile);
  const catalog = (
    signedIn
      ? snap?.catalog ?? []
      : tab === "movies"
        ? DEMO_MOVIES
        : tab === "shows"
          ? DEMO_SHOWS
          : [...DEMO_MOVIES, ...DEMO_SHOWS]
  ).map(applyProfile);
  const localResume = catalog
    .filter((item) => {
      const saved = profile?.progress[item.Id];
      return Boolean(saved && !saved.played && saved.positionTicks > 10 * 10_000_000);
    })
    .sort((a, b) => (profile?.progress[b.Id]?.updatedAt ?? 0) - (profile?.progress[a.Id]?.updatedAt ?? 0));
  const watching = signedIn
    ? uniqueContinueItems(
        [
          ...resume.filter((item) =>
            tab === "home"
              ? true
              : tab === "movies"
                ? item.Type === "Movie" || !item.Type
                : item.Type === "Episode" || item.Type === "Series"
          ),
          ...localResume.filter((item) =>
            tab === "home"
              ? true
              : tab === "movies"
                ? item.Type === "Movie" || !item.Type
                : item.Type === "Episode" || item.Type === "Series"
          ),
        ],
        {
          progress: profile?.progress,
          lastEpisodeBySeries: profile?.lastEpisodeBySeries,
        }
      )
    : (tab === "movies" ? DEMO_MOVIES.slice(0, 4) : tab === "shows" ? DEMO_SHOWS.slice(0, 2) : [...DEMO_MOVIES.slice(0, 3), ...DEMO_SHOWS.slice(0, 2)]).map(applyProfile);
  const latestSigned = signedIn ? latest : catalog;
  const featured = signedIn
    ? buildFeaturedLineup({
        latest: latestSigned,
        newEpisodes: snap?.extraLatest ?? [],
        unplayedMovies:
          snap?.unplayedMovies ?? (snap?.unplayed ?? []).filter((item) => item.Type === "Movie" || !item.Type),
        unplayedSeries: snap?.extraUnplayed ?? [],
        catalog,
        tab: tab === "movies" ? "movies" : tab === "shows" ? "shows" : "home",
      }).map((item) => ({ ...applyProfile(item), hasNewEpisodes: item.hasNewEpisodes }))
    : catalog.slice(0, 6).map((item) => ({ ...item }));

  function matchesShelf(item: JellyfinItem) {
    const needle = query.trim().toLowerCase();
    const hay = `${item.Name} ${item.SeriesName ?? ""} ${(item.Genres ?? []).join(" ")}`.toLowerCase();
    if (needle && !hay.includes(needle)) return false;
    if (filter === "unwatched" && item.UserData?.Played) return false;
    if (filter === "new" && !isNewRelease(item)) return false;
    return true;
  }

  const myList = listedItems(catalog, "watchlist").filter(matchesShelf);
  const favorites = listedItems(catalog, "favorites").filter(matchesShelf);
  const watchingShown = watching.filter(matchesShelf);
  const genres = useMemo(() => {
    const skip = new Set<string>();
    for (const item of [...myList, ...favorites]) {
      skip.add(item.Id);
      if (item.SeriesId) skip.add(item.SeriesId);
    }
    const rows = groupItems(
      catalog.filter((item) => !skip.has(item.Id) && !(item.SeriesId && skip.has(item.SeriesId)) && matchesShelf(item)),
      groups
    );
    return organize ? rows : rows.filter(([, list]) => list.length > 0);
  }, [catalog, myList, favorites, groups, organize, query, filter]);

  function persist(next: GroupStore) {
    if (!session?.userId) return;
    setGroups(next);
    saveGroups(session.userId, tab, next);
  }

  const groupNames = collectGroupNames(groups, catalog);

  if (signedIn && !loaded && !snap) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <NarwhalSpinner label="Herding the movies…" />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <HeroBanner items={featured.length ? featured : latestSigned} />
      <div className="page-gutter mt-6 space-y-6 pb-8 sm:mt-10 sm:space-y-10 sm:pb-10">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {signedIn && loaded && catalog.length === 0 && !error && (
          <div className="space-y-2 text-sm text-muted">
            <p>
              Connected to {session?.serverUrl || "Jellyfin"}, but no{" "}
              {tab === "movies" ? "movies" : tab === "shows" ? "TV shows" : "movies or TV shows"} came
              back.
              {snap?.viewNames.length
                ? ` Libraries on this user: ${snap.viewNames.join(", ")}.`
                : " Jellyfin returned no libraries for this user."}
            </p>
            {libraryHint && <p className="text-foreground">{libraryHint}</p>}
            <p>
              Fix in Jellyfin Web (not Narwhal): Dashboard → Users → this account → turn on library access →
              Save. Then in Narwhal: Sign out → Sign in again on Home network.
            </p>
          </div>
        )}
        {!signedIn && (
          <p className="text-sm text-muted">
            Sample library. Sign in at the top right to load titles from your Jellyfin server.
          </p>
        )}
        <div className="glass-panel glass-edge flex w-full min-w-0 flex-col gap-1.5 rounded-2xl p-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:p-2.5">
          <PageRefreshButton />
          <Button type="button" variant={organize ? "default" : "outline"} size="sm" className="h-8 w-full shrink-0 rounded-full px-3 text-xs sm:h-9 sm:w-auto sm:text-sm" onClick={() => setOrganize((value) => !value)}>
            {organize ? "Done organizing" : "Organize shelves"}
          </Button>
          <label className="relative min-w-0 w-full flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted sm:left-3 sm:size-4" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this library"
              className="h-8 w-full min-w-0 pl-8 text-sm sm:h-9 sm:pl-9"
            />
          </label>
          <div className="flex w-full min-w-0 gap-1 sm:w-auto">
            {(
              [
                ["all", "All"],
                ["unwatched", "Unwatched"],
                ["new", "New"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={filter === id ? "default" : "outline"}
                className="h-8 min-w-0 flex-1 rounded-full px-2 text-xs sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
                onClick={() => setFilter(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          {organize && (
            <form
              className="flex w-full min-w-0 flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                persist(addGroup(groups, newGroup));
                setNewGroup("");
              }}
            >
              <Input
                value={newGroup}
                onChange={(event) => setNewGroup(event.target.value)}
                placeholder="New group name"
                className="h-9 min-w-0 flex-1"
              />
              <Button type="submit" size="sm" className="rounded-full" disabled={!newGroup.trim()}>
                Add group
              </Button>
            </form>
          )}
        </div>
        <Shelf title="Currently watching" items={watchingShown} variant="continue" />
        <Shelf title="My list" items={myList} />
        <Shelf title="Favorites" items={favorites} />
        {genres.map(([genre, items]) => (
          <Shelf
            key={`${tab}-${genre}`}
            title={genre}
            items={items}
            onMove={setMoving}
            onMoveUp={() => persist(moveGroup(groups, genre, -1))}
            onMoveDown={() => persist(moveGroup(groups, genre, 1))}
            onRemove={groups.extra.includes(genre) ? () => persist(removeGroup(groups, genre)) : undefined}
          />
        ))}
      </div>

      <Dialog open={Boolean(moving)} onOpenChange={(open) => !open && setMoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {moving?.Name}</DialogTitle>
            <DialogDescription>
              Now in {moving ? groups.assign[moving.Id] || defaultGroup(moving) : ""}. Pick another group or create one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {groupNames.map((name) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => {
                  if (!moving) return;
                  persist(moveItem(groups, moving.Id, name));
                  setMoving(null);
                }}
              >
                {name}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!moving || !newGroup.trim()) return;
              persist(moveItem(addGroup(groups, newGroup), moving.Id, newGroup.trim()));
              setNewGroup("");
              setMoving(null);
            }}
          >
            <Input value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="New group" />
            <Button type="submit" disabled={!newGroup.trim()}>
              Move here
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
