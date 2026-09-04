"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBanner } from "@/components/hero-banner";
import { Shelf } from "@/components/shelf";
import { useSession } from "@/components/session-provider";
import { fetchLatest, fetchMovies, fetchResume } from "@/lib/client-api";
import { DEMO_MOVIES } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

function groupByGenre(movies: JellyfinItem[]) {
  const map = new Map<string, JellyfinItem[]>();
  for (const movie of movies) {
    for (const genre of movie.Genres ?? []) {
      const list = map.get(genre) ?? [];
      list.push(movie);
      map.set(genre, list);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);
}

const demoResume = DEMO_MOVIES.slice(0, 4);
const demoMovies = [...DEMO_MOVIES].sort((a, b) => a.Name.localeCompare(b.Name));

export function HomeScreen() {
  const { session } = useSession();
  const [resume, setResume] = useState<JellyfinItem[]>([]);
  const [latest, setLatest] = useState<JellyfinItem[]>([]);
  const [movies, setMovies] = useState<JellyfinItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const signedIn = Boolean(session?.signedIn && session.userId);

  useEffect(() => {
    if (!signedIn || !session?.userId) return;
    let cancelled = false;
    Promise.all([
      fetchResume(session.userId).catch(() => [] as JellyfinItem[]),
      fetchLatest(session.userId).catch(() => [] as JellyfinItem[]),
      fetchMovies(session.userId),
    ])
      .then(([nextResume, nextLatest, nextMovies]) => {
        if (cancelled) return;
        setResume(nextResume);
        setLatest(nextLatest);
        setMovies(nextMovies);
        setError(null);
      })
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

  const shownResume = signedIn ? resume : demoResume;
  const shownLatest = signedIn ? latest : DEMO_MOVIES;
  const shownMovies = signedIn ? movies : demoMovies;
  const hero = shownLatest[0] ?? shownMovies[0] ?? DEMO_MOVIES[0];
  const genres = useMemo(() => groupByGenre(shownMovies), [shownMovies]);

  if (signedIn && !loaded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-white/50">
        Loading your library…
      </div>
    );
  }

  return (
    <div className="pb-16">
      <HeroBanner item={hero} />
      <div className="-mt-6 space-y-10">
        {error && (
          <p className="px-4 text-sm text-red-300 sm:px-8">{error}</p>
        )}
        {!signedIn && (
          <p className="px-4 text-sm text-white/45 sm:px-8">
            Sample library. Sign in at the top right to load movies from your Jellyfin server and download them to this laptop.
          </p>
        )}
        <Shelf title="Continue Watching" items={shownResume} />
        <Shelf title="Recently Added" items={shownLatest} />
        {genres.map(([genre, items]) => (
          <Shelf key={genre} title={genre} items={items} />
        ))}
        <Shelf title="All Movies" items={shownMovies} />
      </div>
    </div>
  );
}
