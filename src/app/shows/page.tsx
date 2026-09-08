"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageBack } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { PosterCard } from "@/components/poster-card";
import { useSession } from "@/components/session-provider";
import { fetchLibraryPage } from "@/lib/client-api";
import { DEMO_SHOWS } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function ShowsPage() {
  const { session, loading, preview } = useSession();
  const [remoteShows, setRemoteShows] = useState<JellyfinItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!session?.signedIn || !session.userId) return;
    fetchLibraryPage("Series")
      .then((page) => {
        setRemoteShows(page.items);
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
        setError(err instanceof Error ? err.message : "Could not load TV shows.")
      );
  }, [session?.signedIn, session?.userId]);

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const shows = session?.signedIn ? remoteShows : DEMO_SHOWS;

  return (
    <AppShell>
      <div className="page-gutter py-10 pt-28">
        <PageBack />
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">TV Shows</h1>
        <p className="mt-2 text-zinc-500">Every series in your TV libraries.</p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {shows.map((item) => (
            <PosterCard key={item.Id} item={item} size="lg" />
          ))}
        </div>
        {shows.length === 0 && !error && (
          <p className="mt-16 text-center text-zinc-500">
            No TV shows found on this server.
            {hint ? ` ${hint}` : ""}
          </p>
        )}
      </div>
    </AppShell>
  );
}
