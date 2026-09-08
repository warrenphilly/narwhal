import { fetchEpisodes, fetchMovie } from "@/lib/client-api";
import { type Channel } from "@/lib/channels";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export async function expandChannelItems(channel: Channel, userId: string) {
  const items: JellyfinItem[] = [];
  for (const entry of channel.entries) {
    if (entry.type === "movie" || entry.type === "episode") {
      const item = await fetchMovie(userId, entry.itemId).catch(() => null);
      if (item) items.push(item);
      continue;
    }
    const seriesId = entry.type === "series" ? entry.itemId : entry.seriesId;
    if (!seriesId) continue;
    const episodes = await fetchEpisodes(userId, seriesId, entry.type === "season" ? entry.itemId : undefined);
    items.push(...episodes);
  }
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.Id)) return false;
    seen.add(item.Id);
    return true;
  });
}

export async function expandChannelLineup(channel: Channel, userId: string) {
  const items = await expandChannelItems(channel, userId);
  return stableLineup(channel, items).map((item) => item.Id);
}

export function programMinutes(item: JellyfinItem) {
  const minutes = item.RunTimeTicks ? item.RunTimeTicks / 10_000_000 / 60 : 0;
  if (minutes >= 5) return minutes;
  return item.Type === "Episode" ? 45 : 100;
}

function daySeed(channelId: string) {
  const day = new Date().toISOString().slice(0, 10);
  let n = 0;
  const key = `${channelId}:${day}`;
  for (let i = 0; i < key.length; i += 1) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n;
}

export function stableLineup(channel: Channel, items: JellyfinItem[]) {
  if (channel.kind === "queue" || items.length < 2) return items;
  const copy = [...items];
  let seed = daySeed(channel.id);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type GuideBlock = {
  item: JellyfinItem;
  start: number;
  end: number;
};

export function buildGuideBlocks(channel: Channel, items: JellyfinItem[], start: number, windowMs: number): GuideBlock[] {
  const lineup = stableLineup(channel, items);
  if (!lineup.length) return [];
  const end = start + windowMs;
  const blocks: GuideBlock[] = [];
  let cursor = start;
  let i = 0;
  const hardStop = channel.alwaysOn ? end : Math.min(end, start + Math.max(0.25, channel.hours) * 60 * 60 * 1000);
  while (cursor < hardStop && blocks.length < 80) {
    const item = lineup[i % lineup.length];
    const length = programMinutes(item) * 60 * 1000;
    const next = cursor + length;
    blocks.push({ item, start: cursor, end: next });
    cursor = next;
    i += 1;
  }
  return blocks.filter((block) => block.end > start && block.start < end);
}
