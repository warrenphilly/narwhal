"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Play, Shuffle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBack } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { LibraryButtons } from "@/components/library-buttons";
import { WatchedButton } from "@/components/watched-button";
import { useDownloads } from "@/components/downloads-provider";
import { useSession } from "@/components/session-provider";
import { EpisodeRow } from "@/components/episode-row";
import { TitleCast, TitleGenres, TitleMeta, TitlePoster } from "@/components/title-facts";
import {
  fetchEpisodes,
  fetchLocalTrailers,
  fetchMovie,
  fetchNextUp,
  fetchPlaybackInfo,
  fetchSeasons,
  imageUrl,
  setPlayed,
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
  const { downloadMovie } = useDownloads();
  const [show, setShow] = useState<JellyfinItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [nextUp, setNextUp] = useState<JellyfinItem | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [trailers, setTrailers] = useState<JellyfinItem[]>([]);
  const [streams, setStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayedState] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
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
        setPlayedState(Boolean(item.UserData?.Played));
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
        <div className="page-gutter py-6">
          <PageBack />
          <p className="text-zinc-500">Loading show…</p>
        </div>
      </AppShell>
    );
  }

  if (error || !resolved) {
    return (
      <AppShell>
        <div className="page-gutter py-6">
          <PageBack />
          <p className="text-zinc-500">{error || "Show not found."}</p>
        </div>
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

  async function togglePlayed() {
    const next = !played;
    setPlayedState(next);
    if (!session?.userId || demo) return;
    await setPlayed(session.userId, series.Id, next).catch(() => setPlayedState(!next));
  }

  async function downloadItem(item: JellyfinItem) {
    if (demo) return;
    setSavingId(item.Id);
    await downloadMovie(item).catch(() => undefined);
    setSavingId(null);
  }

  async function downloadSeason() {
    if (demo || !session?.userId) return;
    for (const episode of listed) {
      setSavingId(episode.Id);
      await downloadMovie(episode).catch(() => undefined);
    }
    setSavingId(null);
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
        <div className="relative z-10 mx-auto flex max-w-[1600px] flex-col px-4 py-6 sm:px-8">
          <PageBack className="text-zinc-800 hover:bg-black/6 dark:text-zinc-100 dark:hover:bg-white/10" />
          <div className="flex items-start gap-5 sm:gap-8">
            <TitlePoster item={resolved} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs tracking-[0.24em] text-zinc-700 uppercase dark:text-zinc-200">
                    Series
                  </p>
                  <TitleGenres item={resolved} />
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-zinc-950 drop-shadow-sm sm:text-4xl dark:text-white">
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
                  <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-zinc-800 sm:text-base dark:text-zinc-100">
                    {resolved.Overview}
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                <Button size="lg" className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base" onClick={() => startWatching()}>
                  <Play data-icon="inline-start" className="fill-current" />
                  Start watching
                </Button>
                {canResume && (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base"
                    onClick={resumeWatching}
                  >
                    Resume from {episodeLabel(nextUp!)}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base"
                  onClick={() => shufflePlay()}
                >
                  <Shuffle data-icon="inline-start" />
                  Shuffle
                </Button>
                <WatchedButton played={played} onToggle={() => togglePlayed()} disabled={demo} />
                <LibraryButtons itemId={resolved.Id} disabled={demo} />
              </div>
            </div>
          </div>
          <TitleCast item={resolved} />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 pb-20 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside>
            <p className="pb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Seasons
            </p>
            <div className="flex flex-col">
              {seasonList.length === 0 && (
                <p className="py-6 text-sm text-zinc-500">No seasons yet.</p>
              )}
              {seasonList.map((season) => (
                <div key={season.Id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSeasonId(season.Id)}
                    className={cn(
                      "py-2 text-left text-sm transition",
                      season.Id === activeSeasonId
                        ? "font-semibold text-zinc-950 dark:text-zinc-50"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    {season.Name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={demo || season.Id !== activeSeasonId || Boolean(savingId)}
                    aria-label={`Download ${season.Name}`}
                    onClick={() => downloadSeason()}
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            {listed.length === 0 && (
              <p className="py-10 text-zinc-500">No episodes in this season yet.</p>
            )}
            {listed.map((episode) => (
              <EpisodeRow
                key={episode.Id}
                item={episode}
                downloading={savingId === episode.Id}
                onDownload={() => downloadItem(episode)}
              />
            ))}
            </div>
          </div>
        </div>
    </AppShell>
  );
}
