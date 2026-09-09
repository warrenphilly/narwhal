"use client";

import { useCallback, useEffect, useState } from "react";
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
import { VideoPlayer } from "@/components/video-player";
import { HeroArt } from "@/components/hero-art";
import { PageHero } from "@/components/page-hero";
import { TitleGroupControl } from "@/components/title-group";
import { ChannelAdd } from "@/components/channel-add";
import { PageSpinner } from "@/components/narwhal-spinner";
import { useAppRefresh } from "@/components/page-refresh";
import { fetchLocalTrailers, fetchMovie, fetchPlaybackInfo, setPlayed } from "@/lib/client-api";
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
  const [playing, setPlaying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const demoItem = DEMO_MOVIES.find((movie) => movie.Id === params.id) ?? null;

  useAppRefresh(
    useCallback(() => {
      setItem(null);
      setError(null);
      setReloadKey((value) => value + 1);
    }, [])
  );

  useEffect(() => {
    const id = params.id;
    if (!id || isDemoId(id) || !session?.userId) return;
    let cancelled = false;
    fetchMovie(session.userId, id)
      .then((next) => {
        if (cancelled) return;
        if (next.Type === "Series") {
          router.replace(`/show/${next.Id}`);
          return;
        }
        setItem(next);
        setPlayedState(Boolean(next.UserData?.Played));
        setStreams(next.MediaSources?.[0]?.MediaStreams ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open this title.");
      });
    fetchLocalTrailers(session.userId, id)
      .then((rows) => {
        if (!cancelled) setTrailers(rows);
      })
      .catch(() => {
        if (!cancelled) setTrailers([]);
      });
    fetchPlaybackInfo(id, session.userId)
      .then((info) => {
        if (!cancelled) setStreams(info.MediaSources?.[0]?.MediaStreams ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [params.id, session?.userId, router, reloadKey]);

  if (loading) return <PageSpinner label="Opening your library…" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const resolved = demoItem ?? item;

  if (!resolved && !error) {
    return (
      <AppShell>
        <div className="page-gutter py-6">
          <PageBack />
          <PageSpinner label="Finding this title…" />
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
  const movie = resolved;

  function startPlayback() {
    if (demo) return;
    setPlaying(true);
  }

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

  if (playing && !demo) {
    return (
      <div className="fixed inset-0 z-[80] bg-black">
        <VideoPlayer item={movie} userId={session?.userId} />
      </div>
    );
  }

  return (
    <AppShell>
      <PageHero art={<HeroArt item={demo ? null : resolved} gradient={[from, to]} />}>
        <PageBack className="text-white hover:bg-white/10" />
        <div className="flex items-end gap-4 sm:gap-6">
          <button type="button" className="text-left" onClick={startPlayback}>
            <TitlePoster item={resolved} compact />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs tracking-[0.24em] text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">Movie</p>
              <TitleGenres item={resolved} />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-4xl">
              {resolved.Name}
            </h1>
            <TitleMeta item={resolved} streams={streams} trailers={trailers} />
            {resolved.Taglines?.[0] && (
              <p className="mt-2 text-sm italic text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{resolved.Taglines[0]}</p>
            )}
            {resolved.Overview && (
              <p className="mt-3 line-clamp-3 max-w-2xl text-base leading-relaxed text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                {resolved.Overview}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/watch/${resolved.Id}`}
                className={cn(buttonVariants({ size: "lg" }), "relative z-20 h-11 rounded-full px-6 text-base")}
                onClick={(event) => {
                  if (demo) return;
                  event.preventDefault();
                  startPlayback();
                }}
              >
                <Play data-icon="inline-start" className="fill-current" />
                Play
              </a>
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
      </PageHero>
      <div className="page-gutter mt-6 pb-10">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <TitleGroupControl item={resolved} userId={session?.userId} tab="movies" />
          <ChannelAdd itemId={resolved.Id} userId={session?.userId} name={resolved.Name} type="movie" />
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
    </AppShell>
  );
}
