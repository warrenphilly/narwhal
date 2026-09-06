"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Play, Shuffle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { EpisodeRow } from "@/components/episode-row";
import { TitleCast, TitleMeta, TitlePoster } from "@/components/title-facts";
import {
  fetchEpisodes,
  fetchLocalTrailers,
  fetchMovie,
  fetchNextUp,
  fetchPlaybackInfo,
  fetchSeasons,
  imageUrl,
} from "@/lib/client-api";
import { episodeLabel } from "@/lib/clock";
import { DEMO_SHOWS, demoPosterGradient, isDemoId } from "@/lib/demo-library";
import type { JellyfinItem, MediaStream } from "@/lib/jellyfin-types";
import { cn } from "@/lib/utils";

function demoSeasons(show: JellyfinItem): JellyfinItem[] {
  return [1, 2].map((index) => ({
    Id: `${show.Id}-s${index}`,
    Name: `Season ${index}`,
    Type: "Season",
    SeriesId: show.Id,
    IndexNumber: index,
  }));
}

function demoEpisodes(show: JellyfinItem, seasonIndex = 1): JellyfinItem[] {
  return [1, 2, 3].map((index) => ({
    Id: `${show.Id}-s${seasonIndex}-e${index}`,
    Name: `Episode ${index}`,
    Type: "Episode",
    SeriesId: show.Id,
    SeriesName: show.Name,
    ParentIndexNumber: seasonIndex,
    IndexNumber: index,
    Overview: "Sample episode. Sign in to load seasons from Jellyfin.",
    RunTimeTicks: 2_400_000_0000,
  }));
}

export default function ShowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading, preview } = useSession();
  const [show, setShow] = useState<JellyfinItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [nextUp, setNextUp] = useState<JellyfinItem | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [trailers, setTrailers] = useState<JellyfinItem[]>([]);
  const [streams, setStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const demoShow = DEMO_SHOWS.find((item) => item.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    const userId = session?.userId;
    if (!id || isDemoId(id) || !userId) return;
    let cancelled = false;
    Promise.all([
      fetchMovie(userId, id),
      fetchSeasons(userId, id).catch(() => [] as JellyfinItem[]),
      fetchNextUp(userId, id).catch(() => null),
    ])
      .then(([item, nextSeasons, upcoming]) => {
        if (cancelled) return;
        if (item.Type === "Movie") {
          router.replace(`/movie/${item.Id}`);
          return;
        }
        if (item.Type === "Episode" && item.SeriesId) {
          router.replace(`/show/${item.SeriesId}`);
          return;
        }
        setShow(item);
        setSeasons(nextSeasons);
        setNextUp(upcoming);
        setSeasonId(nextSeasons[0]?.Id ?? null);
        setError(null);
        fetchLocalTrailers(userId, id)
          .then(setTrailers)
          .catch(() => setTrailers([]));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open this show.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, session?.userId, router]);

  useEffect(() => {
    const userId = session?.userId;
    if (!userId || !show || isDemoId(show.Id) || !seasonId) return;
    let cancelled = false;
    fetchEpisodes(userId, show.Id, seasonId)
      .then((items) => {
        if (!cancelled) setEpisodes(items);
        const sample = items[0];
        if (!sample) return;
        fetchPlaybackInfo(sample.Id, userId)
          .then((info) => {
            if (!cancelled) setStreams(info.MediaSources?.[0]?.MediaStreams ?? []);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.userId, show, seasonId]);

  const resolved = demoShow ?? show;
  const demo = Boolean(resolved && isDemoId(resolved.Id));
  const seasonList = useMemo(
    () => (demo && resolved ? demoSeasons(resolved) : seasons),
    [demo, resolved, seasons]
  );
  const activeSeasonId = seasonId ?? seasonList[0]?.Id ?? null;
  const activeSeason = seasonList.find((season) => season.Id === activeSeasonId);
  const listed = useMemo(
    () =>
      demo && resolved
        ? demoEpisodes(resolved, activeSeason?.IndexNumber ?? 1)
        : episodes,
    [demo, resolved, activeSeason, episodes]
  );

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  if (!resolved && !error) {
    return (
      <AppShell>
        <p className="page-gutter py-20 text-zinc-500">Loading show…</p>
      </AppShell>
    );
  }

  if (error || !resolved) {
    return (
      <AppShell>
        <p className="page-gutter py-20 text-zinc-500">{error || "Show not found."}</p>
      </AppShell>
    );
  }

  const series = resolved;
  const [from, to] = demoPosterGradient(series.Id);
  const backdrop = demo
    ? undefined
    : imageUrl(series.Id, {
        type: series.BackdropImageTags?.length ? "Backdrop" : "Primary",
        maxWidth: 1920,
      });
  const canResume = Boolean(nextUp);

  async function startWatching() {
    if (!session?.userId || demo) {
      router.push(`/watch/${series.Id}`);
      return;
    }
    const firstSeasonId = seasonList[0]?.Id;
    const first =
      (firstSeasonId
        ? (await fetchEpisodes(session.userId, series.Id, firstSeasonId))[0]
        : listed[0]) ?? null;
    router.push(`/watch/${first?.Id ?? series.Id}`);
  }

  function resumeWatching() {
    if (nextUp) router.push(`/watch/${nextUp.Id}`);
  }

  async function shufflePlay() {
    if (demo) {
      const pick = listed[Math.floor(Math.random() * listed.length)];
      if (pick) router.push(`/watch/${pick.Id}`);
      return;
    }
    if (!session?.userId) return;
    const all = await fetchEpisodes(session.userId, series.Id).catch(() => listed);
    const pool = all.length ? all : listed;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) router.push(`/watch/${pick.Id}`);
  }

  return (
    <AppShell>
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop
              ? `url(${backdrop})`
              : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        />
        <div className="hero-wash absolute inset-0" />
        <div className="relative mx-auto flex max-w-[1600px] flex-col px-4 pt-28 pb-10 sm:px-8">
          <div className="flex items-start gap-8">
            <TitlePoster item={resolved} />
            <div className="flex min-w-0 flex-1 flex-col lg:max-h-[315px] xl:max-h-[360px]">
              <div className="min-h-0 overflow-hidden">
                <p className="text-xs tracking-[0.24em] text-zinc-700 uppercase dark:text-zinc-200">
                  Series
                </p>
                <h1 className="mt-3 text-5xl font-semibold tracking-tight text-zinc-950 drop-shadow-sm sm:text-6xl dark:text-white">
                  {resolved.Name}
                </h1>
                <TitleMeta
                  item={resolved}
                  streams={streams}
                  trailers={trailers}
                  extras={
                    seasonList.length
                      ? [`${seasonList.length} season${seasonList.length === 1 ? "" : "s"}`]
                      : []
                  }
                />
                {resolved.Overview && (
                  <p className="mt-5 text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">
                    {resolved.Overview}
                  </p>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-3 pt-4">
                <Button size="lg" className="h-12 rounded-full px-6 text-base" onClick={() => startWatching()}>
                  <Play data-icon="inline-start" className="fill-current" />
                  Start watching
                </Button>
                {canResume && (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-12 rounded-full px-6 text-base"
                    onClick={resumeWatching}
                  >
                    Resume from {episodeLabel(nextUp!)}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 rounded-full px-6 text-base"
                  onClick={() => shufflePlay()}
                >
                  <Shuffle data-icon="inline-start" />
                  Shuffle
                </Button>
              </div>
            </div>
          </div>
          <TitleCast item={resolved} />
        </div>
      </div>

      <div className="page-gutter relative z-10 mx-auto max-w-[1600px] pb-20">
        <div className="grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside>
            <p className="pb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Seasons
            </p>
            <div className="flex flex-col">
              {seasonList.length === 0 && (
                <p className="py-6 text-sm text-zinc-500">No seasons yet.</p>
              )}
              {seasonList.map((season) => (
                <button
                  key={season.Id}
                  type="button"
                  onClick={() => setSeasonId(season.Id)}
                  className={cn(
                    "w-full py-2 text-left text-sm transition",
                    season.Id === activeSeasonId
                      ? "font-semibold text-zinc-950 dark:text-zinc-50"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  )}
                >
                  {season.Name}
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            {listed.length === 0 && (
              <p className="py-10 text-zinc-500">No episodes in this season yet.</p>
            )}
            {listed.map((episode) => (
              <EpisodeRow key={episode.Id} item={episode} />
            ))}
            </div>
          </div>
        </div>
    </AppShell>
  );
}
