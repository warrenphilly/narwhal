"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  SeerrEpisode,
  SeerrSearchResult,
  SeerrSeason,
  SeerrSeasonDetail,
  SeerrService,
} from "@/lib/seerr";
import { posterUrl } from "@/lib/seerr";

type SeasonPick = {
  /** Whole season checked */
  all: boolean;
  /** Specific episode numbers when not requesting the whole season */
  episodes: number[];
};

export function SeerrRequestDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
}: {
  item: SeerrSearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [is4k, setIs4k] = useState(false);
  const [servers, setServers] = useState<SeerrService[]>([]);
  const [serverId, setServerId] = useState<number | "">("");
  const [profileId, setProfileId] = useState<number | "">("");
  const [seasons, setSeasons] = useState<SeerrSeason[]>([]);
  const [picks, setPicks] = useState<Record<number, SeasonPick>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, SeerrEpisode[]>>({});
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [monitorNew, setMonitorNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setError(null);
    setIs4k(false);
    setExpanded(null);
    setEpisodesBySeason({});
    setMonitorNew(item.mediaType === "tv");
    const kind = item.mediaType === "tv" ? "sonarr" : "radarr";
    fetch(`/api/seerr/v1/service/${kind}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as SeerrService[]) : [];
        setServers(list);
        const preferred = list.find((row) => row.isDefault && !row.is4k) ?? list.find((row) => !row.is4k) ?? list[0];
        if (preferred) {
          setServerId(preferred.id);
          setProfileId(preferred.activeProfileId ?? preferred.profiles?.[0]?.id ?? "");
        }
      })
      .catch(() => setServers([]));
    if (item.mediaType === "tv") {
      fetch(`/api/seerr/v1/tv/${item.id}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          const next = ((data?.seasons ?? []) as SeerrSeason[]).filter((season) => (season.seasonNumber ?? 0) > 0);
          setSeasons(next);
          // Start with nothing selected so users pick seasons / episodes on purpose.
          setPicks({});
        })
        .catch(() => {
          setSeasons([]);
          setPicks({});
        });
    } else {
      setSeasons([]);
      setPicks({});
    }
  }, [open, item]);

  const active = servers.find((row) => row.id === serverId);
  const profiles = active?.profiles ?? [];
  const has4k = servers.some((row) => row.is4k);
  const visibleServers = servers.filter((row) => Boolean(row.is4k) === is4k);

  const selectedSeasonCount = useMemo(
    () =>
      Object.values(picks).filter((pick) => pick.all || pick.episodes.length > 0).length,
    [picks]
  );

  function chooseQuality(next4k: boolean) {
    setIs4k(next4k);
    const match = servers.filter((row) => Boolean(row.is4k) === next4k);
    const preferred = match.find((row) => row.isDefault) ?? match[0];
    if (preferred) {
      setServerId(preferred.id);
      setProfileId(preferred.activeProfileId ?? preferred.profiles?.[0]?.id ?? "");
    }
  }

  function toggleSeason(seasonNumber: number) {
    setPicks((current) => {
      const existing = current[seasonNumber];
      if (existing?.all) {
        const next = { ...current };
        delete next[seasonNumber];
        return next;
      }
      return { ...current, [seasonNumber]: { all: true, episodes: [] } };
    });
  }

  function toggleEpisode(seasonNumber: number, episodeNumber: number) {
    setPicks((current) => {
      const existing = current[seasonNumber] ?? { all: false, episodes: [] };
      if (existing.all) {
        const eps = (episodesBySeason[seasonNumber] ?? [])
          .map((episode) => episode.episodeNumber)
          .filter((num) => num !== episodeNumber);
        return { ...current, [seasonNumber]: { all: false, episodes: eps } };
      }
      const has = existing.episodes.includes(episodeNumber);
      const episodes = has
        ? existing.episodes.filter((num) => num !== episodeNumber)
        : [...existing.episodes, episodeNumber].sort((a, b) => a - b);
      if (!episodes.length) {
        const next = { ...current };
        delete next[seasonNumber];
        return next;
      }
      const allEps = episodesBySeason[seasonNumber] ?? [];
      const allSelected = allEps.length > 0 && allEps.every((episode) => episodes.includes(episode.episodeNumber));
      return {
        ...current,
        [seasonNumber]: allSelected ? { all: true, episodes: [] } : { all: false, episodes },
      };
    });
  }

  async function expandSeason(seasonNumber: number) {
    if (expanded === seasonNumber) {
      setExpanded(null);
      return;
    }
    setExpanded(seasonNumber);
    if (!item || episodesBySeason[seasonNumber]) return;
    setLoadingSeason(seasonNumber);
    try {
      const response = await fetch(`/api/seerr/v1/tv/${item.id}/season/${seasonNumber}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as SeerrSeasonDetail | null;
      const episodes = (data?.episodes ?? []).filter((episode) => typeof episode.episodeNumber === "number");
      setEpisodesBySeason((current) => ({ ...current, [seasonNumber]: episodes }));
    } catch {
      setEpisodesBySeason((current) => ({ ...current, [seasonNumber]: [] }));
    } finally {
      setLoadingSeason(null);
    }
  }

  function buildSeasonsPayload(): number[] | "all" {
    if (monitorNew && selectedSeasonCount === 0) return "all";
    if (monitorNew && selectedSeasonCount === seasons.length) return "all";
    const numbers = Object.entries(picks)
      .filter(([, pick]) => pick.all || pick.episodes.length > 0)
      .map(([season]) => Number(season))
      .sort((a, b) => a - b);
    if (!numbers.length && monitorNew) return "all";
    return numbers;
  }

  async function submit() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        mediaType: item.mediaType,
        mediaId: item.id,
        is4k,
      };
      if (serverId !== "") body.serverId = serverId;
      if (profileId !== "") body.profileId = profileId;
      if (item.mediaType === "tv") {
        const seasonsPayload = buildSeasonsPayload();
        if (seasonsPayload !== "all" && Array.isArray(seasonsPayload) && seasonsPayload.length === 0) {
          throw new Error("Pick at least one season or episode, or turn on monitoring for the whole series.");
        }
        body.seasons = seasonsPayload;
      }
      await onSubmit(body);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!item) return null;
  const title = item.title || item.name || "Untitled";
  const isTv = item.mediaType === "tv";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Request {title}</DialogTitle>
          <DialogDescription>
            {isTv
              ? "Pick seasons or episodes. Monitoring keeps Sonarr watching for new episodes."
              : "Pick the quality Discover should send to Radarr."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          {posterUrl(item.posterPath) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl(item.posterPath)} alt="" className="h-28 w-[76px] rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-3">
            {has4k && (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={is4k ? "secondary" : "default"} onClick={() => chooseQuality(false)}>
                  HD
                </Button>
                <Button type="button" size="sm" variant={is4k ? "default" : "secondary"} onClick={() => chooseQuality(true)}>
                  4K
                </Button>
              </div>
            )}
            {visibleServers.length > 1 && (
              <div className="space-y-1">
                <Label>Server</Label>
                <select
                  className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-2 text-sm dark:border-white/15"
                  value={serverId}
                  onChange={(event) => {
                    const id = Number(event.target.value);
                    setServerId(id);
                    const next = servers.find((row) => row.id === id);
                    setProfileId(next?.activeProfileId ?? next?.profiles?.[0]?.id ?? "");
                  }}
                >
                  {visibleServers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name || `Server ${row.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {profiles.length > 0 && (
              <div className="space-y-1">
                <Label>Quality</Label>
                <div className="flex flex-wrap gap-2">
                  {profiles.map((row) => (
                    <Button
                      key={row.id}
                      type="button"
                      size="sm"
                      className="rounded-full"
                      variant={profileId === row.id ? "default" : "outline"}
                      onClick={() => setProfileId(row.id)}
                    >
                      {row.name || `Profile ${row.id}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isTv && (
          <label className="flex items-start gap-2 rounded-2xl border border-black/8 p-3 text-sm dark:border-white/10">
            <input
              type="checkbox"
              className="mt-1"
              checked={monitorNew}
              onChange={(event) => setMonitorNew(event.target.checked)}
            />
            <span>
              <span className="font-medium">Monitor for new episodes</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {selectedSeasonCount
                  ? "Sonarr will keep selected seasons monitored and grab new episodes as they air."
                  : "With nothing selected, request the whole series and keep it monitored for new seasons/episodes."}
              </span>
            </span>
          </label>
        )}

        {seasons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Seasons & episodes</Label>
              <button
                type="button"
                className="text-xs text-zinc-500 underline"
                onClick={() => {
                  const allOn = selectedSeasonCount === seasons.length && seasons.every((s) => picks[s.seasonNumber]?.all);
                  if (allOn) setPicks({});
                  else {
                    const next: Record<number, SeasonPick> = {};
                    for (const season of seasons) next[season.seasonNumber] = { all: true, episodes: [] };
                    setPicks(next);
                  }
                }}
              >
                {selectedSeasonCount === seasons.length ? "Clear" : "All seasons"}
              </button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {seasons.map((season) => {
                const pick = picks[season.seasonNumber];
                const episodeList = episodesBySeason[season.seasonNumber];
                const isOpen = expanded === season.seasonNumber;
                return (
                  <div
                    key={season.seasonNumber}
                    className="rounded-2xl border border-black/8 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(pick?.all) || (pick?.episodes.length ?? 0) > 0}
                        onChange={() => toggleSeason(season.seasonNumber)}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm"
                        onClick={() => expandSeason(season.seasonNumber)}
                      >
                        <span className="font-medium">{season.name || `Season ${season.seasonNumber}`}</span>
                        {typeof season.episodeCount === "number" && (
                          <span className="ml-2 text-xs text-zinc-500">{season.episodeCount} ep</span>
                        )}
                        {pick && !pick.all && pick.episodes.length > 0 && (
                          <span className="ml-2 text-xs text-[#AA5CC3]">
                            {pick.episodes.length} selected
                          </span>
                        )}
                        {pick?.all && <span className="ml-2 text-xs text-zinc-500">whole season</span>}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-zinc-500"
                        onClick={() => expandSeason(season.seasonNumber)}
                      >
                        {isOpen ? "Hide" : "Episodes"}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-black/8 px-3 py-2 dark:border-white/10">
                        {loadingSeason === season.seasonNumber && (
                          <p className="text-xs text-zinc-500">Loading episodes…</p>
                        )}
                        {loadingSeason !== season.seasonNumber && !episodeList?.length && (
                          <p className="text-xs text-zinc-500">No episode list from Seerr for this season.</p>
                        )}
                        {episodeList && episodeList.length > 0 && (
                          <>
                            <p className="mb-2 text-[11px] leading-snug text-zinc-500">
                              Jellyseerr downloads by season. Selecting episodes marks that season to request;
                              Sonarr then monitors those episodes once the season is added.
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {episodeList.map((episode) => {
                                const checked =
                                  Boolean(pick?.all) || Boolean(pick?.episodes.includes(episode.episodeNumber));
                                return (
                                  <label
                                    key={episode.id ?? episode.episodeNumber}
                                    className="flex items-start gap-2 text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-0.5"
                                      checked={checked}
                                      onChange={() => toggleEpisode(season.seasonNumber, episode.episodeNumber)}
                                    />
                                    <span>
                                      <span className="font-medium">E{episode.episodeNumber}</span>
                                      {episode.name ? ` · ${episode.name}` : ""}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button disabled={busy} onClick={() => submit()} className="rounded-full">
          {busy
            ? "Requesting…"
            : isTv
              ? monitorNew && !selectedSeasonCount
                ? "Request & monitor series"
                : "Request"
              : "Request"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
