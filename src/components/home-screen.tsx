"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeroBanner } from "@/components/hero-banner";
import { MediaPills } from "@/components/media-pills";
import { Shelf } from "@/components/shelf";
import { useSession } from "@/components/session-provider";
import {
  featuredWithNewReleases,
  fetchLatest,
  fetchMovies,
  fetchResume,
  fetchShows,
  fetchUnplayedRecent,
  isNewRelease,
  seriesForNewEpisodes,
} from "@/lib/client-api";
import { DEMO_MOVIES, DEMO_SHOWS } from "@/lib/demo-library";
import { rememberTab, tabFromSearch } from "@/lib/media-tab";
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

export function HomeScreen() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("tab"));
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
      fetchShows(session.userId).catch(() => [] as JellyfinItem[]),
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

  const movieResume = signedIn
    ? resume.filter((item) => item.Type === "Movie" || !item.Type)
    : DEMO_MOVIES.slice(0, 4);
  const showResume = signedIn
    ? resume.filter((item) => item.Type === "Episode" || item.Type === "Series")
    : DEMO_SHOWS.slice(0, 2);
  const movieLatest = signedIn ? latestMovies : DEMO_MOVIES;
  const showLatest = signedIn ? latestShows : DEMO_SHOWS;
  const allMovies = signedIn ? movies : DEMO_MOVIES;
  const allShows = signedIn ? shows : DEMO_SHOWS;

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
    <div className="pb-16">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center">
          <div className="pointer-events-auto">
            <MediaPills value={tab} />
          </div>
        </div>
        <HeroBanner items={featured} />
      </div>
      <div className="page-gutter -mt-6 space-y-10">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!signedIn && (
          <p className="text-sm text-zinc-500">
            Sample library. Sign in at the top right to load titles from your Jellyfin server.
          </p>
        )}
        <Shelf title="Currently watching" items={watching} variant="continue" />
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
