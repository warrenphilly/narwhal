import { jf } from "@/lib/client-api";
import { loadChannels, saveChannels, type Channel } from "@/lib/channels";
import { loadGroups, saveGroups, type GroupStore } from "@/lib/library-groups";
import type { MediaTab } from "@/lib/media-tab";

const CLIENT = "narwhal";
const PREF_ID = "usersettings";
const PART_SIZE = 1800;
const TABS: MediaTab[] = ["home", "movies", "shows"];

export type ProfileSyncStore = {
  profiles: unknown[];
  activeId: string | null;
};

export type NarwhalSyncPayload = {
  version: 1;
  updatedAt: number;
  profiles: ProfileSyncStore;
  channels: Channel[];
  groups: Partial<Record<MediaTab, GroupStore>>;
};

type DisplayPreferences = {
  Id?: string;
  Client?: string;
  CustomPrefs?: Record<string, string | null>;
  SortBy?: string;
  SortOrder?: string;
  RememberIndexing?: boolean;
  RememberSorting?: boolean;
  ScrollDirection?: string;
  ShowBackdrop?: boolean;
  ShowSidebar?: boolean;
  PrimaryImageHeight?: number;
  PrimaryImageWidth?: number;
};

function stampKey(userId: string) {
  return `narwhal-sync-stamp:${userId}`;
}

function profilesKey(userId: string) {
  return `narwhal-profiles:${userId}`;
}

export function bumpSyncStamp(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(stampKey(userId), String(Date.now()));
}

export function readSyncStamp(userId: string) {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(stampKey(userId)) || 0);
}

function readProfiles(userId: string): ProfileSyncStore {
  try {
    const raw = window.localStorage.getItem(profilesKey(userId));
    if (!raw) return { profiles: [], activeId: null };
    const parsed = JSON.parse(raw) as ProfileSyncStore;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      activeId: parsed.activeId ?? null,
    };
  } catch {
    return { profiles: [], activeId: null };
  }
}

export function collectLocalSync(userId: string): NarwhalSyncPayload {
  const groups: Partial<Record<MediaTab, GroupStore>> = {};
  for (const tab of TABS) groups[tab] = loadGroups(userId, tab);
  return {
    version: 1,
    updatedAt: readSyncStamp(userId) || Date.now(),
    profiles: readProfiles(userId),
    channels: loadChannels(userId),
    groups,
  };
}

export function applyLocalSync(userId: string, payload: NarwhalSyncPayload) {
  window.localStorage.setItem(profilesKey(userId), JSON.stringify(payload.profiles));
  saveChannels(userId, payload.channels ?? []);
  for (const tab of TABS) {
    const group = payload.groups?.[tab];
    if (group) saveGroups(userId, tab, group);
  }
  window.localStorage.setItem(stampKey(userId), String(payload.updatedAt || Date.now()));
  window.dispatchEvent(new Event("narwhal-sync-applied"));
}

function encodeParts(json: string) {
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += PART_SIZE) {
    parts.push(json.slice(i, i + PART_SIZE));
  }
  return parts;
}

function decodeParts(prefs: Record<string, string | null | undefined>) {
  const count = Number(prefs.narwhalSyncParts || 0);
  if (!count) {
    const single = prefs.narwhalSync;
    return single ? String(single) : null;
  }
  let out = "";
  for (let i = 0; i < count; i++) {
    out += prefs[`narwhalSync${i}`] || "";
  }
  return out || null;
}

async function loadRemotePrefs(userId: string) {
  return jf<DisplayPreferences>(
    `DisplayPreferences/${PREF_ID}?userId=${encodeURIComponent(userId)}&client=${CLIENT}`
  );
}

export async function fetchRemoteSync(userId: string): Promise<NarwhalSyncPayload | null> {
  const prefs = await loadRemotePrefs(userId);
  const raw = decodeParts(prefs.CustomPrefs ?? {});
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NarwhalSyncPayload;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function pushLocalSync(userId: string, payload?: NarwhalSyncPayload) {
  const body = payload ?? collectLocalSync(userId);
  const next: NarwhalSyncPayload = { ...body, updatedAt: Date.now(), version: 1 };
  const current = await loadRemotePrefs(userId);
  const custom: Record<string, string | null> = { ...(current.CustomPrefs ?? {}) };

  for (const key of Object.keys(custom)) {
    if (key === "narwhalSync" || key === "narwhalSyncParts" || /^narwhalSync\d+$/.test(key)) {
      delete custom[key];
    }
  }

  const parts = encodeParts(JSON.stringify(next));
  custom.narwhalSyncParts = String(parts.length);
  parts.forEach((part, index) => {
    custom[`narwhalSync${index}`] = part;
  });

  await jf(`DisplayPreferences/${PREF_ID}?userId=${encodeURIComponent(userId)}&client=${CLIENT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...current,
      Id: current.Id || userId,
      Client: CLIENT,
      CustomPrefs: custom,
      SortBy: current.SortBy || "SortName",
      SortOrder: current.SortOrder || "Ascending",
      RememberIndexing: current.RememberIndexing ?? false,
      RememberSorting: current.RememberSorting ?? false,
      ScrollDirection: current.ScrollDirection || "Horizontal",
      ShowBackdrop: current.ShowBackdrop ?? true,
      ShowSidebar: current.ShowSidebar ?? false,
      PrimaryImageHeight: current.PrimaryImageHeight || 250,
      PrimaryImageWidth: current.PrimaryImageWidth || 250,
    }),
  });

  window.localStorage.setItem(stampKey(userId), String(next.updatedAt));
  return next;
}

export async function syncProfileData(userId: string): Promise<"uploaded" | "downloaded"> {
  const local = collectLocalSync(userId);
  const remote = await fetchRemoteSync(userId);
  const stamp = readSyncStamp(userId);

  if (!remote) {
    await pushLocalSync(userId, local);
    return "uploaded";
  }

  // New browser / never synced here — pull the Jellyfin copy first.
  if (!stamp) {
    applyLocalSync(userId, remote);
    return "downloaded";
  }

  if (stamp >= remote.updatedAt) {
    await pushLocalSync(userId, local);
    return "uploaded";
  }

  applyLocalSync(userId, remote);
  return "downloaded";
}
