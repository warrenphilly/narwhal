"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { EpisodeRow } from "@/components/episode-row";
import { TitleCast, TitleGenres, TitleMeta, TitlePoster } from "@/components/title-facts";
import { Button } from "@/components/ui/button";
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
        <p className="px-8 py-24 text-zinc-500">Loading title…</p>
      </AppShell>
    );
  }

  if (error || !resolved) {
    return (
      <AppShell>
        <p className="px-8 py-24 text-zinc-500">{error || "Title not found."}</p>
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
      <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop
              ? `url(${backdrop})`
              : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        />
        <div className="hero-wash absolute inset-0" />
        <div className="relative mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-col justify-end px-4 pt-24 pb-8 sm:px-8">
          <div className="flex items-start gap-8">
            <TitlePoster item={resolved} />
            <div className="flex min-w-0 flex-1 flex-col lg:max-h-[315px] xl:max-h-[360px]">
              <div className="min-h-0 overflow-hidden">
                <p className="text-xs tracking-[0.24em] text-zinc-700 uppercase dark:text-zinc-200">Movie</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-5xl font-semibold tracking-tight text-zinc-950 drop-shadow-sm sm:text-6xl dark:text-white">
                    {resolved.Name}
                  </h1>
                  <TitleGenres item={resolved} />
                </div>
                <TitleMeta item={resolved} streams={streams} trailers={trailers} />
                {resolved.Taglines?.[0] && (
                  <p className="mt-3 text-base italic text-zinc-700 dark:text-zinc-200">{resolved.Taglines[0]}</p>
                )}
                {resolved.Overview && (
                  <p className="mt-5 text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">
                    {resolved.Overview}
                  </p>
                )}
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              </div>
              <div className="mt-auto flex flex-wrap gap-3 pt-4">
                <Button
                  size="lg"
                  className="h-12 rounded-full px-6 text-base"
                  onClick={() => router.push(`/watch/${resolved.Id}`)}
                >
                  <Play data-icon="inline-start" className="fill-current" />
                  Play
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 rounded-full px-6 text-base"
                  disabled={demo || saving}
                  onClick={onDownload}
                >
                  <Download data-icon="inline-start" />
                  {demo ? "Connect to download" : saving ? "Saving…" : "Download to laptop"}
                </Button>
                <WatchedButton played={played} onToggle={() => togglePlayed()} disabled={demo} />
              </div>
            </div>
          </div>
          <TitleCast item={resolved} />
        </div>
      </div>
      <div className="page-gutter relative z-10 mx-auto max-w-[1600px] pb-20">
        <EpisodeRow
          item={resolved}
          eyebrow="Movie"
          downloading={saving}
          onDownload={() => onDownload().catch(() => undefined)}
        />
      </div>
    </AppShell>
  );
}
