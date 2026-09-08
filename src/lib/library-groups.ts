import type { MediaTab } from "@/lib/media-tab";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export type GroupStore = {
  order: string[];
  extra: string[];
  assign: Record<string, string>;
};

const empty: GroupStore = { order: [], extra: [], assign: {} };

export function defaultGroup(item: JellyfinItem) {
  return item.Genres?.[0] || "More";
}

export function collectGroupNames(store: GroupStore, items: JellyfinItem[] = [], extra: string[] = []) {
  const names = new Set<string>();
  for (const name of store.order) if (name) names.add(name);
  for (const name of store.extra) if (name) names.add(name);
  for (const name of Object.values(store.assign)) if (name) names.add(name);
  for (const item of items) {
    for (const genre of item.Genres ?? []) if (genre) names.add(genre);
  }
  for (const name of extra) if (name) names.add(name);
  names.add("More");
  return [...names].sort((a, b) => a.localeCompare(b));
}

function storageKey(userId: string, tab: MediaTab) {
  return `narwhal.groups:${userId}:${tab}`;
}

export function loadGroups(userId: string, tab: MediaTab): GroupStore {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(storageKey(userId, tab));
    if (!raw) return { ...empty, assign: {} };
    const parsed = JSON.parse(raw) as Partial<GroupStore>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      extra: Array.isArray(parsed.extra) ? parsed.extra : [],
      assign: parsed.assign && typeof parsed.assign === "object" ? parsed.assign : {},
    };
  } catch {
    return { order: [], extra: [], assign: {} };
  }
}

export function saveGroups(userId: string, tab: MediaTab, store: GroupStore) {
  localStorage.setItem(storageKey(userId, tab), JSON.stringify(store));
}

export function groupItems(items: JellyfinItem[], store: GroupStore) {
  const buckets = new Map<string, JellyfinItem[]>();
  for (const item of items) {
    const name = store.assign[item.Id] || defaultGroup(item);
    const list = buckets.get(name) ?? [];
    list.push(item);
    buckets.set(name, list);
  }
  const names = [...store.order];
  for (const name of buckets.keys()) {
    if (!names.includes(name)) names.push(name);
  }
  for (const name of store.extra) {
    if (!names.includes(name)) names.push(name);
  }
  return names
    .map((name) => [name, buckets.get(name) ?? []] as const)
    .filter(([name, list]) => list.length > 0 || store.extra.includes(name));
}

export function moveItem(store: GroupStore, itemId: string, group: string): GroupStore {
  const name = group.trim();
  if (!name) return store;
  const extra = store.extra.includes(name) || store.order.includes(name) ? store.extra : [...store.extra, name];
  const order = store.order.includes(name) ? store.order : [...store.order, name];
  return {
    order,
    extra,
    assign: { ...store.assign, [itemId]: name },
  };
}

export function moveGroup(store: GroupStore, name: string, dir: -1 | 1): GroupStore {
  const names = [...store.order];
  for (const row of store.extra) if (!names.includes(row)) names.push(row);
  const index = names.indexOf(name);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= names.length) return { ...store, order: names };
  const copy = [...names];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return { ...store, order: copy };
}

export function addGroup(store: GroupStore, name: string): GroupStore {
  const next = name.trim();
  if (!next || store.extra.includes(next) || store.order.includes(next)) return store;
  return { ...store, extra: [...store.extra, next], order: [...store.order, next] };
}

export function removeGroup(store: GroupStore, name: string): GroupStore {
  const assign = { ...store.assign };
  for (const [id, group] of Object.entries(assign)) {
    if (group === name) delete assign[id];
  }
  return {
    order: store.order.filter((row) => row !== name),
    extra: store.extra.filter((row) => row !== name),
    assign,
  };
}
