"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { EpisodeRow } from "@/components/episode-row";
import { TitleCast, TitleMeta, TitlePoster } from "@/components/title-facts";
import { Button } from "@/components/ui/button";
import { useDownloads } from "@/components/downloads-provider";
import { useSession } from "@/components/session-provider";
import { fetchLocalTrailers, fetchMovie, fetchPlaybackInfo, imageUrl } from "@/lib/client-api";
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
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop
              ? `url(${backdrop})`
              : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        />
        <div className="hero-wash absolute inset-0" />
        <div className="relative mx-auto flex w-full max-w-[1600px] flex-1 items-end gap-8 px-4 pt-28 pb-12 sm:px-8">
          <TitlePoster item={resolved} />
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.24em] text-zinc-700 uppercase dark:text-zinc-200">Movie</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-zinc-950 drop-shadow-sm sm:text-6xl dark:text-white">
              {resolved.Name}
            </h1>
            <TitleMeta item={resolved} streams={streams} trailers={trailers} />
            {resolved.Taglines?.[0] && (
              <p className="mt-3 text-base italic text-zinc-700 dark:text-zinc-200">{resolved.Taglines[0]}</p>
            )}
            {resolved.Overview && (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">
                {resolved.Overview}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
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
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>
      <div className="page-gutter relative z-10 mx-auto max-w-[1600px] pb-8">
        <EpisodeRow item={resolved} eyebrow="Movie" />
      </div>
      <div className="page-gutter mx-auto max-w-[1600px] pb-20">
        <TitleCast item={resolved} />
      </div>
    </AppShell>
  );
}
