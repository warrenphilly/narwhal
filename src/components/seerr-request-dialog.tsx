"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { SeerrSearchResult, SeerrSeason, SeerrService } from "@/lib/seerr";
import { posterUrl } from "@/lib/seerr";

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
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setError(null);
    setIs4k(false);
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
          setPicked(next.map((season) => season.seasonNumber));
        })
        .catch(() => {
          setSeasons([]);
          setPicked([]);
        });
    } else {
      setSeasons([]);
      setPicked([]);
    }
  }, [open, item]);

  const active = servers.find((row) => row.id === serverId);
  const profiles = active?.profiles ?? [];
  const has4k = servers.some((row) => row.is4k);
  const visibleServers = servers.filter((row) => Boolean(row.is4k) === is4k);

  function chooseQuality(next4k: boolean) {
    setIs4k(next4k);
    const match = servers.filter((row) => Boolean(row.is4k) === next4k);
    const preferred = match.find((row) => row.isDefault) ?? match[0];
    if (preferred) {
      setServerId(preferred.id);
      setProfileId(preferred.activeProfileId ?? preferred.profiles?.[0]?.id ?? "");
    }
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
      if (item.mediaType === "tv") body.seasons = picked.length ? picked : "all";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Request {title}</DialogTitle>
          <DialogDescription>Pick the quality Discover should send to Radarr or Sonarr.</DialogDescription>
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
                <p className="text-xs text-zinc-500">Same list Radarr/Sonarr would offer in Seerr.</p>
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
        {seasons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Seasons</Label>
              <button
                type="button"
                className="text-xs text-zinc-500 underline"
                onClick={() =>
                  setPicked(picked.length === seasons.length ? [] : seasons.map((season) => season.seasonNumber))
                }
              >
                {picked.length === seasons.length ? "Clear" : "All"}
              </button>
            </div>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
              {seasons.map((season) => (
                <label key={season.seasonNumber} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(season.seasonNumber)}
                    onChange={() =>
                      setPicked((current) =>
                        current.includes(season.seasonNumber)
                          ? current.filter((value) => value !== season.seasonNumber)
                          : [...current, season.seasonNumber]
                      )
                    }
                  />
                  {season.name || `Season ${season.seasonNumber}`}
                </label>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button disabled={busy} onClick={() => submit()} className="rounded-full">
          {busy ? "Requesting…" : "Request"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
