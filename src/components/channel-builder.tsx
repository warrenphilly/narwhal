"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchEpisodes, fetchSeasons, imageUrl } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasEntry, toggleEntry, type Channel, type ChannelEntry } from "@/lib/channels";
import { groupItems, loadGroups } from "@/lib/library-groups";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";

function Tile({
  item,
  label,
  on,
  onToggle,
}: {
  item: JellyfinItem;
  label?: string;
  on: boolean;
  onToggle: () => void;
}) {
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  const imageId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`overflow-hidden rounded-xl text-left ring-2 transition ${
        on ? "ring-[#00A4DC]" : "ring-transparent hover:ring-zinc-400"
      }`}
    >
      <div className="relative aspect-[2/3] bg-zinc-200 dark:bg-zinc-800">
        {demo ? (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(imageId, { maxHeight: 420 })} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <span
          className={`absolute inset-x-1 bottom-1 rounded-full px-2 py-1 text-center text-[11px] font-medium ${
            on ? "bg-[#00A4DC] text-white" : "bg-black/70 text-white"
          }`}
        >
          {on ? "Added" : "Add"}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 px-0.5 text-xs text-zinc-700 dark:text-zinc-200">{label || item.Name}</p>
    </button>
  );
}

export function ChannelBuilder({
  channel,
  catalog,
  userId,
  onChange,
}: {
  channel: Channel;
  catalog: JellyfinItem[];
  userId?: string;
  onChange: (next: Channel) => void;
}) {
  const locked = channel.scope !== "both";
  const [browse, setBrowse] = useState<"movies" | "shows">(channel.scope === "shows" ? "shows" : "movies");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<JellyfinItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (channel.scope === "movies") setBrowse("movies");
    if (channel.scope === "shows") setBrowse("shows");
  }, [channel.scope]);

  const pool = useMemo(() => {
    return catalog.filter((item) => (browse === "movies" ? item.Type === "Movie" : item.Type === "Series"));
  }, [catalog, browse]);

  const groups = useMemo(() => {
    const store = userId ? loadGroups(userId, browse) : { order: [], extra: [], assign: {} };
    const q = query.trim().toLowerCase();
    const list = q ? pool.filter((item) => item.Name.toLowerCase().includes(q)) : pool;
    return groupItems(list, store);
  }, [pool, query, userId, browse]);

  useEffect(() => {
    if (!picked || picked.Type !== "Series" || !userId) {
      setSeasons([]);
      setEpisodes([]);
      setSeasonId(null);
      return;
    }
    fetchSeasons(userId, picked.Id)
      .then(setSeasons)
      .catch(() => setSeasons([]));
  }, [picked, userId]);

  useEffect(() => {
    if (!picked || !seasonId || !userId) {
      setEpisodes([]);
      return;
    }
    fetchEpisodes(userId, picked.Id, seasonId)
      .then(setEpisodes)
      .catch(() => setEpisodes([]));
  }, [picked, seasonId, userId]);

  function add(entry: Omit<ChannelEntry, "id">) {
    onChange(toggleEntry(channel, entry));
  }

  return (
    <section className="w-full rounded-none border-y border-black/8 bg-white/70 p-4 sm:p-6 dark:border-white/10 dark:bg-black/30">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <h2 className="w-full text-center text-lg font-semibold">Build {channel.name}</h2>
        <span className="text-xs text-zinc-500">{channel.entries.length} in the lineup</span>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="flex rounded-full bg-black/5 p-1 dark:bg-white/10">
          {(!locked || browse === "movies") && (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              variant={browse === "movies" ? "default" : "ghost"}
              onClick={() => {
                setBrowse("movies");
                setPicked(null);
              }}
            >
              Movies
            </Button>
          )}
          {(!locked || browse === "shows") && (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              variant={browse === "shows" ? "default" : "ghost"}
              onClick={() => {
                setBrowse("shows");
                setPicked(null);
              }}
            >
              TV shows
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <Input
          className="w-full max-w-xl"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${browse === "movies" ? "movies" : "TV shows"}`}
        />
      </div>

      {picked?.Type === "Series" && (
        <div className="mt-4 rounded-2xl border border-black/8 p-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{picked.Name}</p>
            <Button
              size="sm"
              className="rounded-full"
              variant={hasEntry(channel, "series", picked.Id) ? "default" : "outline"}
              onClick={() => add({ type: "series", itemId: picked.Id, label: `${picked.Name} (whole show)` })}
            >
              {hasEntry(channel, "series", picked.Id) ? "Whole show added" : "Add whole show"}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPicked(null)}>
              Close
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Or add one season, or pick episodes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {seasons.map((season) => (
              <Button
                key={season.Id}
                size="sm"
                className="rounded-full"
                variant={seasonId === season.Id ? "default" : "outline"}
                onClick={() => setSeasonId(season.Id)}
              >
                {season.Name}
              </Button>
            ))}
          </div>
          {seasonId && (
            <div className="mt-3">
              <Button
                size="sm"
                className="rounded-full"
                variant={hasEntry(channel, "season", seasonId) ? "default" : "outline"}
                onClick={() => {
                  const season = seasons.find((row) => row.Id === seasonId);
                  add({
                    type: "season",
                    itemId: seasonId,
                    seriesId: picked.Id,
                    label: `${picked.Name} · ${season?.Name || "Season"}`,
                  });
                }}
              >
                {hasEntry(channel, "season", seasonId) ? "Season added" : "Add this whole season"}
              </Button>
              <div className="mt-3 grid w-full grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {episodes.map((episode) => (
                  <Tile
                    key={episode.Id}
                    item={episode}
                    label={`${episode.IndexNumber ? `E${episode.IndexNumber} · ` : ""}${episode.Name}`}
                    on={hasEntry(channel, "episode", episode.Id)}
                    onToggle={() =>
                      add({
                        type: "episode",
                        itemId: episode.Id,
                        seriesId: picked.Id,
                        label: `${picked.Name} · ${episode.Name}`,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-8">
        {groups.map(([name, items]) => (
          <section key={name}>
            <h3 className="mb-3 text-lg font-semibold">{name}</h3>
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {items.map((item) => {
                const series = item.Type === "Series";
                const on = series ? hasEntry(channel, "series", item.Id) : hasEntry(channel, "movie", item.Id);
                return (
                  <Tile
                    key={item.Id}
                    item={item}
                    on={on}
                    onToggle={() => {
                      if (series) {
                        setPicked(item);
                        return;
                      }
                      add({ type: "movie", itemId: item.Id, label: item.Name });
                    }}
                  />
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="text-center text-sm text-zinc-500">No {browse === "movies" ? "movies" : "shows"} to add.</p>
        )}
      </div>
    </section>
  );
}
