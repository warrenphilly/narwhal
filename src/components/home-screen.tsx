"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBanner } from "@/components/hero-banner";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { Shelf } from "@/components/shelf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { useProfiles } from "@/components/profile-provider";
import {
  featuredWithNewReleases,
  fetchLatest,
  fetchMovies,
  fetchResume,
  fetchShows,
  fetchUnplayedRecent,
  fetchViews,
  isNewRelease,
  seriesForNewEpisodes,
  uniqueItems,
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

type HomeSnap = {
  resume: JellyfinItem[];
  latest: JellyfinItem[];
  extraLatest: JellyfinItem[];
  unplayed: JellyfinItem[];
  extraUnplayed: JellyfinItem[];
  catalog: JellyfinItem[];
  viewNames: string[];
};

const homeCache = new Map<string, HomeSnap>();

function cacheKey(userId: string, tab: MediaTab) {
  return `${userId}:${tab}`;
}

export function LibraryHome({ kind }: { kind: MediaTab }) {
  const { session } = useSession();
  const tab = kind;
  useEffect(() => {
    rememberTab(tab);
  }, [tab]);
  const signedIn = Boolean(session?.signedIn && session.userId);
  const cached = signedIn && session?.userId ? homeCache.get(cacheKey(session.userId, tab)) : undefined;
  const [snap, setSnap] = useState<HomeSnap | undefined>(cached);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(cached));
  const [groups, setGroups] = useState<GroupStore>({ order: [], extra: [], assign: {} });
  const [organize, setOrganize] = useState(false);
  const [moving, setMoving] = useState<JellyfinItem | null>(null);
  const [newGroup, setNewGroup] = useState("");

  useEffect(() => {
    if (!signedIn || !session?.userId) return;
    let cancelled = false;
    const userId = session.userId;
    const key = cacheKey(userId, tab);
    const existing = homeCache.get(key);
    if (existing) {
      setSnap(existing);
      setLoaded(true);
    }

    const movie = tab === "movies";
    Promise.all([
      fetchResume(userId).catch(() => [] as JellyfinItem[]),
      fetchLatest(userId, movie ? "Movie" : "Series").catch(() => [] as JellyfinItem[]),
      movie ? Promise.resolve([] as JellyfinItem[]) : fetchLatest(userId, "Episode").catch(() => [] as JellyfinItem[]),
      fetchUnplayedRecent(userId, movie ? "Movie" : "Episode").catch(() => [] as JellyfinItem[]),
      movie ? Promise.resolve([] as JellyfinItem[]) : fetchUnplayedRecent(userId, "Series").catch(() => [] as JellyfinItem[]),
      movie ? fetchMovies(userId) : fetchShows(userId),
      fetchViews(userId).catch(() => [] as JellyfinItem[]),
    ])
      .then(([resume, latest, extraLatest, unplayed, extraUnplayed, catalog, views]) => {
        if (cancelled) return;
        const next: HomeSnap = {
          resume,
          latest,
          extraLatest,
          unplayed,
          extraUnplayed,
          catalog,
          viewNames: views.map((view) => view.Name).filter(Boolean),
        };
        homeCache.set(key, next);
        setSnap(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your library.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, session?.userId, tab]);

  useEffect(() => {
    if (!session?.userId) return;
    setGroups(loadGroups(session.userId, tab));
  }, [session?.userId, tab]);

  const { applyProfile, listedItems, profile } = useProfiles();
  const resume = (snap?.resume ?? []).map(applyProfile);
  const latest = (snap?.latest ?? []).map(applyProfile);
  const catalog = (signedIn ? snap?.catalog ?? [] : tab === "movies" ? DEMO_MOVIES : DEMO_SHOWS).map(applyProfile);
  const localResume = catalog
    .filter((item) => {
      const saved = profile?.progress[item.Id];
      return Boolean(saved && !saved.played && saved.positionTicks > 10 * 10_000_000);
    })
    .sort((a, b) => (profile?.progress[b.Id]?.updatedAt ?? 0) - (profile?.progress[a.Id]?.updatedAt ?? 0));
  const watching = signedIn
    ? uniqueItems([
        ...resume.filter((item) =>
          tab === "movies" ? item.Type === "Movie" || !item.Type : item.Type === "Episode" || item.Type === "Series"
        ),
        ...localResume.filter((item) =>
          tab === "movies" ? item.Type === "Movie" || !item.Type : item.Type === "Episode" || item.Type === "Series"
        ),
      ])
    : (tab === "movies" ? DEMO_MOVIES.slice(0, 4) : DEMO_SHOWS.slice(0, 2)).map(applyProfile);
  const latestSigned = signedIn ? latest : catalog;
  const featured =
    tab === "movies"
      ? featuredWithNewReleases(latestSigned, [...(snap?.unplayed ?? []), ...latestSigned].filter(isNewRelease).map(applyProfile))
      : featuredWithNewReleases(latestSigned, [
          ...seriesForNewEpisodes(
            [...(snap?.extraLatest ?? []), ...(snap?.unplayed ?? [])].filter(isNewRelease),
            catalog
          ),
          ...(snap?.extraUnplayed ?? []).filter(isNewRelease),
        ].map(applyProfile));
  const myList = listedItems(catalog, "watchlist");
  const favorites = listedItems(catalog, "favorites");
  const genres = useMemo(() => {
    const skip = new Set<string>();
    for (const item of [...myList, ...favorites]) {
      skip.add(item.Id);
      if (item.SeriesId) skip.add(item.SeriesId);
    }
    const rows = groupItems(
      catalog.filter((item) => !skip.has(item.Id) && !(item.SeriesId && skip.has(item.SeriesId))),
      groups
    );
    return organize ? rows : rows.filter(([, list]) => list.length > 0);
  }, [catalog, myList, favorites, groups, organize]);

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
      <div className="page-gutter mt-6 space-y-8">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {signedIn && loaded && catalog.length === 0 && !error && (
          <p className="text-sm text-zinc-500">
            Connected to {session?.serverUrl || "Jellyfin"}, but no {tab === "movies" ? "movies" : "TV shows"} came
            back.
            {snap?.viewNames.length
              ? ` Libraries on this user: ${snap.viewNames.join(", ")}.`
              : " This user has no libraries enabled."}{" "}
            Switch to Home network under Who&apos;s watching if the address is still a Tailscale 100.x URL.
          </p>
        )}
        {!signedIn && (
          <p className="text-sm text-zinc-500">
            Sample library. Sign in at the top right to load titles from your Jellyfin server.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={organize ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setOrganize((value) => !value)}>
            {organize ? "Done organizing" : "Organize shelves"}
          </Button>
          {organize && (
            <form
              className="flex gap-2"
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
                className="h-8 w-44"
              />
              <Button type="submit" size="sm" className="rounded-full" disabled={!newGroup.trim()}>
                Add group
              </Button>
            </form>
          )}
        </div>
        <Shelf title="Currently watching" items={watching} variant="continue" />
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
