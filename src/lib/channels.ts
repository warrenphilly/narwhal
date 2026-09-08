export type ChannelKind = "shuffle" | "queue";
export type ChannelScope = "movies" | "shows" | "both";
export type ChannelEntryType = "movie" | "series" | "season" | "episode";

export type ChannelEntry = {
  id: string;
  type: ChannelEntryType;
  itemId: string;
  seriesId?: string;
  label: string;
};

export type Channel = {
  id: string;
  name: string;
  kind: ChannelKind;
  scope: ChannelScope;
  alwaysOn: boolean;
  hours: number;
  entries: ChannelEntry[];
  itemIds?: string[];
};

const empty: Channel[] = [];

function storageKey(userId: string) {
  return `narwhal.channels:${userId}`;
}

export function normalizeChannel(row: Channel): Channel {
  const entries = Array.isArray(row.entries) ? row.entries.filter((entry) => entry?.itemId) : [];
  if (!entries.length && Array.isArray(row.itemIds)) {
    for (const itemId of row.itemIds) {
      entries.push({ id: itemId, type: "movie", itemId, label: "Title" });
    }
  }
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "queue" ? "queue" : "shuffle",
    scope: row.scope === "movies" || row.scope === "shows" ? row.scope : "both",
    alwaysOn: row.alwaysOn !== false,
    hours: typeof row.hours === "number" ? row.hours : 24,
    entries,
  };
}

export function loadChannels(userId: string): Channel[] {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Channel[];
    return Array.isArray(parsed) ? parsed.filter((row) => row?.id && row.name).map(normalizeChannel) : [];
  } catch {
    return [];
  }
}

export function saveChannels(userId: string, channels: Channel[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(channels.map(normalizeChannel)));
}

export function createChannel(partial: Omit<Channel, "id">): Channel {
  return normalizeChannel({ ...partial, id: crypto.randomUUID(), entries: partial.entries ?? [] });
}

export function upsertChannel(list: Channel[], next: Channel) {
  const ready = normalizeChannel(next);
  const index = list.findIndex((row) => row.id === ready.id);
  if (index < 0) return [...list, ready];
  const copy = [...list];
  copy[index] = ready;
  return copy;
}

export function removeChannel(list: Channel[], id: string) {
  return list.filter((row) => row.id !== id);
}

export function sameEntry(a: ChannelEntry, b: Pick<ChannelEntry, "type" | "itemId">) {
  return a.type === b.type && a.itemId === b.itemId;
}

export function hasEntry(channel: Channel, type: ChannelEntryType, itemId: string) {
  return channel.entries.some((entry) => sameEntry(entry, { type, itemId }));
}

export function toggleEntry(channel: Channel, entry: Omit<ChannelEntry, "id">): Channel {
  const exists = channel.entries.find((row) => sameEntry(row, entry));
  return {
    ...channel,
    entries: exists
      ? channel.entries.filter((row) => row.id !== exists.id)
      : [...channel.entries, { ...entry, id: crypto.randomUUID() }],
  };
}

export function shuffleIds(ids: string[]) {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function nextPlayIndex(_channel: Channel, order: string[], index: number) {
  if (!order.length) return -1;
  const next = index + 1;
  return next < order.length ? next : 0;
}

export function channelBlockMs(channel: Channel) {
  if (channel.alwaysOn) return Number.POSITIVE_INFINITY;
  return Math.max(0.25, channel.hours) * 60 * 60 * 1000;
}

export function lineupCount(channel: Channel) {
  return channel.entries.length;
}
