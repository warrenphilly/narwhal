"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBanner } from "@/components/hero-banner";
import { Shelf } from "@/components/shelf";
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
} from "@/lib/client-api";
import { DEMO_MOVIES, DEMO_SHOWS } from "@/lib/demo-library";
import { rememberTab, type MediaTab } from "@/lib/media-tab";
import type { JellyfinItem } from "@/lib/jellyfin-types";

function groupByGenre(items: JellyfinItem[]) {
  const map = new Map<string, JellyfinItem[]>();
  for (const item of items) {
    for (const genre of item.Genres ?? []) {
      const list = map.get(genre) ?? [];
      list.push(item);
      map.set(genre, list);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);
}

export function LibraryHome({ kind }: { kind: MediaTab }) {
  const { session } = useSession();
  const tab = kind;
  useEffect(() => {
    rememberTab(tab);
  }, [tab]);
  const [resume, setResume] = useState<JellyfinItem[]>([]);
  const [latestMovies, setLatestMovies] = useState<JellyfinItem[]>([]);
  const [latestShows, setLatestShows] = useState<JellyfinItem[]>([]);
  const [latestEpisodes, setLatestEpisodes] = useState<JellyfinItem[]>([]);
  const [unplayedMovies, setUnplayedMovies] = useState<JellyfinItem[]>([]);
  const [unplayedEpisodes, setUnplayedEpisodes] = useState<JellyfinItem[]>([]);
  const [unplayedSeries, setUnplayedSeries] = useState<JellyfinItem[]>([]);
  const [movies, setMovies] = useState<JellyfinItem[]>([]);
  const [shows, setShows] = useState<JellyfinItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewNames, setViewNames] = useState<string[]>([]);

  const signedIn = Boolean(session?.signedIn && session.userId);

  useEffect(() => {
    if (!signedIn || !session?.userId) return;
    let cancelled = false;
    Promise.all([
      fetchResume(session.userId).catch(() => [] as JellyfinItem[]),
      fetchLatest(session.userId, "Movie").catch(() => [] as JellyfinItem[]),
      fetchLatest(session.userId, "Series").catch(() => [] as JellyfinItem[]),
      fetchLatest(session.userId, "Episode").catch(() => [] as JellyfinItem[]),
      fetchUnplayedRecent(session.userId, "Movie").catch(() => [] as JellyfinItem[]),
      fetchUnplayedRecent(session.userId, "Episode").catch(() => [] as JellyfinItem[]),
      fetchUnplayedRecent(session.userId, "Series").catch(() => [] as JellyfinItem[]),
      fetchMovies(session.userId),
      fetchShows(session.userId),
      fetchViews(session.userId).catch(() => [] as JellyfinItem[]),
    ])
      .then(
        ([
          nextResume,
          nextLatestMovies,
          nextLatestShows,
          nextLatestEpisodes,
          nextUnplayedMovies,
          nextUnplayedEpisodes,
          nextUnplayedSeries,
          nextMovies,
          nextShows,
          nextViews,
        ]) => {
          if (cancelled) return;
          setResume(nextResume);
          setLatestMovies(nextLatestMovies);
          setLatestShows(nextLatestShows);
          setLatestEpisodes(nextLatestEpisodes);
          setUnplayedMovies(nextUnplayedMovies);
          setUnplayedEpisodes(nextUnplayedEpisodes);
          setUnplayedSeries(nextUnplayedSeries);
          setMovies(nextMovies);
          setShows(nextShows);
          setViewNames(nextViews.map((view) => view.Name).filter(Boolean));
          setError(null);
        }
      )
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your library.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, session?.userId]);

  const { applyProfile, listedItems } = useProfiles();
  const movieResume = (signedIn
    ? resume.filter((item) => item.Type === "Movie" || !item.Type)
    : DEMO_MOVIES.slice(0, 4)
  ).map(applyProfile);
  const showResume = (signedIn
    ? resume.filter((item) => item.Type === "Episode" || item.Type === "Series")
    : DEMO_SHOWS.slice(0, 2)
  ).map(applyProfile);
  const movieLatest = (signedIn ? latestMovies : DEMO_MOVIES).map(applyProfile);
  const showLatest = (signedIn ? latestShows : DEMO_SHOWS).map(applyProfile);
  const allMovies = (signedIn ? movies : DEMO_MOVIES).map(applyProfile);
  const allShows = (signedIn ? shows : DEMO_SHOWS).map(applyProfile);
  const myList = listedItems(tab === "movies" ? allMovies : allShows, "watchlist");
  const favorites = listedItems(tab === "movies" ? allMovies : allShows, "favorites");

  const featuredMovies = featuredWithNewReleases(
    movieLatest,
    [...unplayedMovies, ...movieLatest].filter(isNewRelease)
  );
  const featuredShows = featuredWithNewReleases(showLatest, [
    ...seriesForNewEpisodes(
      [...latestEpisodes, ...unplayedEpisodes].filter(isNewRelease),
      allShows
    ),
    ...unplayedSeries.filter(isNewRelease),
  ]);
  const featured = tab === "movies" ? featuredMovies : featuredShows;
  const watching = tab === "movies" ? movieResume : showResume;
  const catalog = tab === "movies" ? allMovies : allShows;
  const genres = useMemo(() => groupByGenre(catalog), [catalog]);

  if (signedIn && !loaded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-zinc-500">
        Loading your library…
      </div>
    );
  }

  return (
    <div className="pb-8">
      <HeroBanner items={featured} />
      <div className="page-gutter mt-6 space-y-8">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {signedIn && loaded && catalog.length === 0 && !error && (
          <p className="text-sm text-zinc-500">
            Connected to {session?.serverUrl || "Jellyfin"}, but no {tab === "movies" ? "movies" : "TV shows"} came
            back.
            {viewNames.length
              ? ` Libraries on this user: ${viewNames.join(", ")}.`
              : " This user has no libraries enabled."}{" "}
            Switch to Home network under Who&apos;s watching if the address is still a Tailscale 100.x URL.
          </p>
        )}
        {!signedIn && (
          <p className="text-sm text-zinc-500">
            Sample library. Sign in at the top right to load titles from your Jellyfin server.
          </p>
        )}
        <Shelf title="Currently watching" items={watching} variant="continue" />
        <Shelf title="My list" items={myList} />
        <Shelf title="Favorites" items={favorites} />
        {tab === "shows" && <Shelf title="Featured" items={featuredShows} />}
        {tab === "movies" && <Shelf title="Recently added" items={featuredMovies} />}
        {genres.map(([genre, items]) => (
          <Shelf key={`${tab}-${genre}`} title={genre} items={items} />
        ))}
        <Shelf title={tab === "movies" ? "All movies" : "All TV shows"} items={catalog} />
      </div>
    </div>
  );
}
