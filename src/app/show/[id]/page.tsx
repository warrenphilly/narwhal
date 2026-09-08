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
import { useProfiles } from "@/components/profile-provider";
import { useSession } from "@/components/session-provider";
import { VideoPlayer } from "@/components/video-player";
import { EpisodeRow } from "@/components/episode-row";
import { TitleCast, TitleGenres, TitleMeta, TitlePoster } from "@/components/title-facts";
import { HeroArt } from "@/components/hero-art";
import { PageHero } from "@/components/page-hero";
import { TitleGroupControl } from "@/components/title-group";
import { ChannelAdd } from "@/components/channel-add";
import { PageSpinner } from "@/components/narwhal-spinner";
import {
  fetchEpisodes,
  fetchLocalTrailers,
  fetchMovie,
  fetchNextUp,
  fetchPlaybackInfo,
  fetchSeasons,
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
  const { profile } = useProfiles();
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
  const [playItem, setPlayItem] = useState<JellyfinItem | null>(null);
  const demoShow = DEMO_SHOWS.find((item) => item.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    const userId = session?.userId;
    if (!id || isDemoId(id) || !userId) return;
    let cancelled = false;
    Promise.all([fetchMovie(userId, id)])
      .then(([item]) => {
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
        setSeasonId("__all__");
        setError(null);
        fetchSeasons(userId, id)
          .then((nextSeasons) => {
            if (cancelled) return;
            setSeasons(nextSeasons);
            if (nextSeasons[0]?.Id) setSeasonId(nextSeasons[0].Id);
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setSeasons([]);
              setError(err instanceof Error ? err.message : "Could not load seasons.");
            }
          });
        fetchNextUp(userId, id)
          .then((upcoming) => {
            if (!cancelled) setNextUp(upcoming);
          })
          .catch(() => undefined);
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
    const requestSeason = seasonId === "__all__" ? undefined : seasonId;
    fetchEpisodes(userId, show.Id, requestSeason)
      .then((items) => {
        if (!cancelled) {
          setEpisodes(items);
          if (items.length) setError(null);
        }
        const sample = items[0];
        if (!sample) return;
        fetchPlaybackInfo(sample.Id, userId)
          .then((info) => {
            if (!cancelled) setStreams(info.MediaSources?.[0]?.MediaStreams ?? []);
          })
          .catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setEpisodes([]);
          setError(err instanceof Error ? err.message : "Could not load episodes.");
        }
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

  if (loading) return <PageSpinner label="Opening your library…" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  if (!resolved && !error) {
    return (
      <AppShell>
        <div className="page-gutter py-6">
          <PageBack />
          <PageSpinner label="Finding this show…" />
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
  const canResume = Boolean(nextUp || profile?.lastEpisodeBySeries?.[series.Id]?.episodeId);

  async function startWatching() {
    if (!session?.userId || demo) {
      window.location.assign(`/watch/${series.Id}`);
      return;
    }
    const first =
      listed[0] ??
      (await fetchEpisodes(session.userId, series.Id, seasonList[0]?.Id))[0] ??
      null;
    if (first) setPlayItem(first);
  }

  async function resumeWatching() {
    const lastId = profile?.lastEpisodeBySeries?.[series.Id]?.episodeId;
    const fromList = lastId ? listed.find((episode) => episode.Id === lastId) : null;
    if (fromList) {
      setPlayItem(fromList);
      return;
    }
    if (lastId && session?.userId && !demo) {
      const episode = await fetchMovie(session.userId, lastId).catch(() => null);
      if (episode) {
        setPlayItem(episode);
        return;
      }
    }
    if (nextUp) setPlayItem(nextUp);
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
      if (pick) setPlayItem(pick);
      return;
    }
    if (!session?.userId) return;
    const all = await fetchEpisodes(session.userId, series.Id).catch(() => listed);
    const pool = all.length ? all : listed;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) setPlayItem(pick);
  }

  if (playItem && !demo) {
    return (
      <div className="fixed inset-0 z-[80] bg-black">
        <VideoPlayer item={playItem} userId={session?.userId} />
      </div>
    );
  }

  return (
    <AppShell>
      <PageHero art={<HeroArt item={demo ? null : resolved} gradient={[from, to]} />}>
        <PageBack className="text-white hover:bg-white/10" />
        <div className="flex items-end gap-5 sm:gap-8">
          <TitlePoster item={resolved} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs tracking-[0.24em] text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">Series</p>
                <TitleGenres item={resolved} />
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-4xl">
                {resolved.Name}
              </h1>
              <TitleMeta
                item={resolved}
                streams={streams}
                trailers={trailers}
                extras={
                  seasonList.length ? [`${seasonList.length} season${seasonList.length === 1 ? "" : "s"}`] : []
                }
              />
              {resolved.Overview && (
                <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-base">
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
      </PageHero>

      <div className="page-gutter mt-6 pb-20">
        <div className="mb-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <TitleGroupControl item={resolved} userId={session?.userId} tab="shows" />
          <ChannelAdd itemId={resolved.Id} userId={session?.userId} name={resolved.Name} type="series" />
        </div>
        <TitleCast item={resolved} />
        <div className="mt-8 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside>
            <p className="pb-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              Seasons
            </p>
            <div className="flex flex-col">
              {seasonList.length === 0 && (
                <p className="py-6 text-sm text-muted">
                  {listed.length ? "All episodes" : "Looking for seasons…"}
                </p>
              )}
              {seasonList.map((season) => (
                <div key={season.Id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSeasonId(season.Id)}
                    className={cn(
                      "py-2 text-left text-sm transition",
                      season.Id === activeSeasonId
                        ? "font-semibold text-[var(--page-fg)]"
                        : "text-muted hover:text-[var(--page-fg)]"
                    )}
                  >
                    {season.Name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8 shrink-0",
                      season.Id === activeSeasonId ? "text-[var(--page-fg)]" : "text-muted"
                    )}
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
              <p className="py-10 text-zinc-500">
                {error ? error : "No episodes in this season yet."}
              </p>
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
