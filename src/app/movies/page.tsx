"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageBack } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { PosterCard } from "@/components/poster-card";
import { useSession } from "@/components/session-provider";
import { fetchLibraryPage } from "@/lib/client-api";
import { DEMO_MOVIES } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function MoviesPage() {
  const { session, loading, preview } = useSession();
  const [remoteMovies, setRemoteMovies] = useState<JellyfinItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!session?.signedIn || !session.userId) return;
    fetchLibraryPage("Movie")
      .then((page) => {
        setRemoteMovies(page.items);
        setHint(
          page.items.length
            ? ""
            : `Connected to ${page.serverUrl}. ${
                page.views.length
                  ? `Libraries: ${page.views.map((view) => view.name).join(", ")}.`
                  : "This Jellyfin user has no libraries enabled."
              }`
        );
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load movies.")
      );
  }, [session?.signedIn, session?.userId]);

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const movies = session?.signedIn ? remoteMovies : DEMO_MOVIES;

  return (
    <AppShell>
      <div className="page-gutter py-6">
        <PageBack />
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Movies</h1>
        <p className="mt-2 text-zinc-500">Every title in your movie libraries.</p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {movies.map((item) => (
            <PosterCard key={item.Id} item={item} layout="grid" />
          ))}
        </div>
        {movies.length === 0 && !error && (
          <p className="mt-16 text-center text-zinc-500">
            No movies found on this server.
            {hint ? ` ${hint}` : ""}
          </p>
        )}
      </div>
    </AppShell>
  );
}
