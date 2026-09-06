"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { TitleFacts, TitlePoster } from "@/components/title-facts";
import {
  continueImageUrl,
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
import { formatRuntime } from "@/lib/jellyfin-types";
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
        <div className="relative mx-auto flex max-w-[1600px] items-start gap-8 px-4 pt-28 pb-10 sm:px-8">
          <TitlePoster item={resolved} />
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.24em] text-zinc-700 uppercase dark:text-zinc-200">
              Series
            </p>
            <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-zinc-950 drop-shadow-sm sm:text-6xl dark:text-white">
              {resolved.Name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {resolved.ProductionYear && <span>{resolved.ProductionYear}</span>}
              {resolved.OfficialRating && (
                <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-600">
                  {resolved.OfficialRating}
                </span>
              )}
              {resolved.CommunityRating && <span>{resolved.CommunityRating.toFixed(1)} ★</span>}
              {seasonList.length > 0 && (
                <span>
                  {seasonList.length} season{seasonList.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {resolved.Overview && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">
                {resolved.Overview}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
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
            </div>
            {resolved.Genres && resolved.Genres.length > 0 && (
              <p className="mt-6 text-sm text-zinc-500">{resolved.Genres.join(" · ")}</p>
            )}
            <TitleFacts item={resolved} streams={streams} trailers={trailers} />
          </div>
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
            {listed.map((episode) => {
              const progress = episode.UserData?.PlayedPercentage;
              return (
                <button
                  key={episode.Id}
                  type="button"
                  onClick={() => router.push(`/watch/${episode.Id}`)}
                  className="flex w-full gap-4 py-4 text-left transition hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.03]"
                >
                    <div className="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-xl bg-zinc-200 sm:w-[220px] dark:bg-zinc-800">
                      {demo ? (
                        <div
                          className="absolute inset-0"
                          style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={continueImageUrl(episode)}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                      )}
                      {typeof progress === "number" && progress > 0 && progress < 100 && (
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
                          <div className="h-full bg-white" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                        {episodeLabel(episode)}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {episode.Name}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {formatRuntime(episode.RunTimeTicks)}
                        {episode.UserData?.Played ? " · Watched" : ""}
                      </p>
                      {episode.Overview && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {episode.Overview}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
    </AppShell>
  );
}
