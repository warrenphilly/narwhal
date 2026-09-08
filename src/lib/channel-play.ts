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

export type LiveBlock = GuideBlock & {
  offsetMs: number;
  offsetSeconds: number;
  lineupIndex: number;
};

export function guideAnchor(at = Date.now()) {
  const d = new Date(at);
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  d.setSeconds(0, 0);
  return d.getTime();
}

function blockLengthMs(item: JellyfinItem) {
  return programMinutes(item) * 60 * 1000;
}

function scheduleEndMs(channel: Channel, anchor: number) {
  if (channel.alwaysOn) return Number.POSITIVE_INFINITY;
  return anchor + Math.max(0.25, channel.hours) * 60 * 60 * 1000;
}

export function findLiveBlock(channel: Channel, items: JellyfinItem[], at = Date.now()): LiveBlock | null {
  const lineup = stableLineup(channel, items);
  if (!lineup.length) return null;

  const anchor = guideAnchor(at);
  const end = scheduleEndMs(channel, anchor);
  if (!channel.alwaysOn && at >= end) return null;

  let cursor = anchor;
  let i = 0;
  const maxSteps = lineup.length * 500;

  while (i < maxSteps) {
    const item = lineup[i % lineup.length];
    const length = blockLengthMs(item);
    const blockStart = cursor;
    const blockEnd = cursor + length;

    if (at >= blockStart && at < blockEnd) {
      const offsetMs = at - blockStart;
      return {
        item,
        start: blockStart,
        end: blockEnd,
        offsetMs,
        offsetSeconds: offsetMs / 1000,
        lineupIndex: i % lineup.length,
      };
    }

    if (!channel.alwaysOn && blockEnd >= end) return null;

    cursor = blockEnd;
    i += 1;
  }

  return null;
}

export function findGuideBlock(
  channel: Channel,
  items: JellyfinItem[],
  blockStart: number,
  at = Date.now()
): LiveBlock | null {
  const lineup = stableLineup(channel, items);
  if (!lineup.length) return null;

  let cursor = guideAnchor(blockStart);
  let i = 0;
  const maxSteps = lineup.length * 500;

  while (i < maxSteps) {
    const item = lineup[i % lineup.length];
    const length = blockLengthMs(item);
    if (cursor === blockStart) {
      const blockEnd = cursor + length;
      if (at < blockStart || at >= blockEnd) return findLiveBlock(channel, items, at);
      const offsetMs = at - blockStart;
      return {
        item,
        start: blockStart,
        end: blockEnd,
        offsetMs,
        offsetSeconds: offsetMs / 1000,
        lineupIndex: i % lineup.length,
      };
    }
    cursor += length;
    i += 1;
  }

  return findLiveBlock(channel, items, at);
}

export function buildGuideBlocks(channel: Channel, items: JellyfinItem[], start: number, windowMs: number): GuideBlock[] {
  const lineup = stableLineup(channel, items);
  if (!lineup.length) return [];
  const end = start + windowMs;
  const blocks: GuideBlock[] = [];
  let cursor = start;
  let i = 0;
  const hardStop = channel.alwaysOn ? end : Math.min(end, start + Math.max(0.25, channel.hours) * 60 * 60 * 1000);
  const maxBlocks = channel.alwaysOn ? 240 : 80;
  while (cursor < hardStop && blocks.length < maxBlocks) {
    const item = lineup[i % lineup.length];
    const length = programMinutes(item) * 60 * 1000;
    const next = cursor + length;
    blocks.push({ item, start: cursor, end: next });
    cursor = next;
    i += 1;
  }
  return blocks.filter((block) => block.end > start && block.start < end);
}
