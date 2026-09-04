"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { PosterCard } from "@/components/poster-card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { searchMovies } from "@/lib/client-api";
import { DEMO_MOVIES } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function SearchPage() {
  const { session, loading, preview } = useSession();
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<JellyfinItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed || !session?.signedIn || !session.userId) return;
    const handle = setTimeout(() => {
      searchMovies(session.userId!, trimmed)
        .then((items) => {
          setRemoteResults(items);
          setError(null);
        })
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Search failed.")
        );
    }, 250);
    return () => clearTimeout(handle);
  }, [trimmed, session?.signedIn, session?.userId]);

  const results = useMemo(() => {
    if (!trimmed) return [];
    if (!session?.signedIn) {
      return DEMO_MOVIES.filter((item) =>
        item.Name.toLowerCase().includes(trimmed.toLowerCase())
      );
    }
    return remoteResults;
  }, [trimmed, session?.signedIn, remoteResults]);

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Search</h1>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Movie title"
          className="mt-6 h-14 max-w-xl rounded-2xl bg-white text-lg"
          autoFocus
        />
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((item) => (
            <PosterCard key={item.Id} item={item} />
          ))}
        </div>
        {trimmed && results.length === 0 && !error && (
          <p className="mt-16 text-zinc-500">No titles matched “{trimmed}”.</p>
        )}
      </div>
    </AppShell>
  );
}
