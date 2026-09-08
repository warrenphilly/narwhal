"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBack } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { EpisodeRow } from "@/components/episode-row";
import { TitleCast, TitleGenres, TitleMeta, TitlePoster } from "@/components/title-facts";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LibraryButtons } from "@/components/library-buttons";
import { WatchedButton } from "@/components/watched-button";
import { useDownloads } from "@/components/downloads-provider";
import { useSession } from "@/components/session-provider";
import { fetchLocalTrailers, fetchMovie, fetchPlaybackInfo, imageUrl, setPlayed } from "@/lib/client-api";
import { DEMO_MOVIES, demoPosterGradient, isDemoId } from "@/lib/demo-library";
import type { JellyfinItem, MediaStream } from "@/lib/jellyfin-types";

export default function MoviePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading, preview } = useSession();
  const { downloadMovie } = useDownloads();
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [trailers, setTrailers] = useState<JellyfinItem[]>([]);
  const [streams, setStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [played, setPlayedState] = useState(false);
  const demoItem = DEMO_MOVIES.find((movie) => movie.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    if (!id || isDemoId(id) || !session?.userId) return;
    fetchMovie(session.userId, id)
      .then((next) => {
        if (next.Type === "Series") {
          router.replace(`/show/${next.Id}`);
          return;
        }
        setItem(next);
        setPlayedState(Boolean(next.UserData?.Played));
        setStreams(next.MediaSources?.[0]?.MediaStreams ?? []);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not open this title.")
      );
    fetchLocalTrailers(session.userId, id)
      .then(setTrailers)
      .catch(() => setTrailers([]));
    fetchPlaybackInfo(id, session.userId)
      .then((info) => setStreams(info.MediaSources?.[0]?.MediaStreams ?? []))
      .catch(() => undefined);
  }, [params.id, session?.userId, router]);

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const resolved = demoItem ?? item;

  if (!resolved && !error) {
    return (
      <AppShell>
        <div className="page-gutter py-6">
          <PageBack />
          <p className="text-zinc-500">Loading title…</p>
        </div>
      </AppShell>
    );
  }

  if (error || !resolved) {
    return (
      <AppShell>
        <div className="page-gutter py-6">
          <PageBack />
          <p className="text-zinc-500">{error || "Title not found."}</p>
        </div>
      </AppShell>
    );
  }

  const demo = isDemoId(resolved.Id);
  const [from, to] = demoPosterGradient(resolved.Id);
  const backdrop = demo
    ? undefined
    : imageUrl(resolved.Id, {
        type: resolved.BackdropImageTags?.length ? "Backdrop" : "Primary",
        maxWidth: 1920,
      });
  const movie = resolved;

  async function togglePlayed() {
    const next = !played;
    setPlayedState(next);
    if (!session?.userId || demo) return;
    await setPlayed(session.userId, movie.Id, next).catch(() => setPlayedState(!next));
  }

  async function onDownload() {
    setSaving(true);
    setError(null);
    try {
      await downloadMovie(movie);
      router.push("/downloads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop
              ? `url(${backdrop})`
              : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        />
        <div className="hero-wash absolute inset-0" />
        <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col px-4 py-6 sm:px-8">
          <PageBack className="text-zinc-800 hover:bg-black/6 dark:text-zinc-100 dark:hover:bg-white/10" />
          <div className="flex items-start gap-4 sm:gap-6">
            <TitlePoster item={resolved} compact />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs tracking-[0.24em] text-zinc-700 uppercase dark:text-zinc-200">Movie</p>
                <TitleGenres item={resolved} />
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-zinc-950 drop-shadow-sm sm:text-4xl dark:text-white">
                {resolved.Name}
              </h1>
              <TitleMeta item={resolved} streams={streams} trailers={trailers} />
              {resolved.Taglines?.[0] && (
                <p className="mt-2 text-sm italic text-zinc-700 dark:text-zinc-200">{resolved.Taglines[0]}</p>
              )}
              {resolved.Overview && (
                <p className="mt-3 line-clamp-4 text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
                  {resolved.Overview}
                </p>
              )}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/watch/${resolved.Id}`}
                  className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6 text-base")}
                >
                  <Play data-icon="inline-start" className="fill-current" />
                  Play
                </Link>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-11 rounded-full px-6 text-base"
                  disabled={demo || saving}
                  onClick={onDownload}
                >
                  <Download data-icon="inline-start" />
                  {demo ? "Connect to download" : saving ? "Saving…" : "Download to laptop"}
                </Button>
                <WatchedButton played={played} onToggle={() => togglePlayed()} disabled={demo} />
                <LibraryButtons itemId={resolved.Id} disabled={demo} />
              </div>
            </div>
          </div>
          <TitleCast item={resolved} />
          <div className="mt-2">
            <EpisodeRow
              item={resolved}
              eyebrow="Movie"
              downloading={saving}
              onDownload={() => onDownload().catch(() => undefined)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
