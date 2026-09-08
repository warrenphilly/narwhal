"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "@/components/session-provider";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export type ViewingProfile = {
  id: string;
  name: string;
  color: string;
  emoji: string;
  favorites: string[];
  watchlist: string[];
  progress: Record<string, { positionTicks: number; played: boolean; updatedAt: number }>;
};

const COLORS = ["#AA5CC3", "#00A4DC", "#F59E0B", "#FB7185", "#34D399", "#818CF8"];

type Store = {
  profiles: ViewingProfile[];
  activeId: string | null;
};

type ProfileContextValue = {
  profiles: ViewingProfile[];
  profile: ViewingProfile | null;
  picking: boolean;
  setPicking: (open: boolean) => void;
  selectProfile: (id: string) => void;
  addProfile: (name: string) => void;
  updateProfile: (id: string, patch: Partial<Pick<ViewingProfile, "name" | "color" | "emoji">>) => void;
  removeProfile: (id: string) => void;
  toggleFavorite: (itemId: string) => void;
  toggleWatchlist: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  isWatchlisted: (itemId: string) => boolean;
  rememberProgress: (itemId: string, positionTicks: number, played?: boolean) => void;
  applyProfile: (item: JellyfinItem) => JellyfinItem;
  listedItems: (items: JellyfinItem[], kind: "favorites" | "watchlist") => JellyfinItem[];
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function storageKey(userId?: string) {
  return `narwhal-profiles:${userId || "local"}`;
}

function readStore(userId?: string): Store {
  if (typeof window === "undefined") return { profiles: [], activeId: null };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { profiles: [], activeId: null };
    const parsed = JSON.parse(raw) as Store;
    return {
      ...parsed,
      profiles: (parsed.profiles ?? []).map((row) => ({ ...row, emoji: row.emoji || "🐋" })),
    };
  } catch {
    return { profiles: [], activeId: null };
  }
}

function writeStore(userId: string | undefined, store: Store) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(store));
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [store, setStore] = useState<Store>({ profiles: [], activeId: null });
  const [picking, setPicking] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session?.signedIn) {
      setStore({ profiles: [], activeId: null });
      setPicking(false);
      setReady(true);
      return;
    }
    const next = readStore(session.userId);
    if (!next.profiles.length) {
      const first: ViewingProfile = {
        id: crypto.randomUUID(),
        name: session.userName || "Me",
        color: COLORS[0],
        emoji: "🐋",
        favorites: [],
        watchlist: [],
        progress: {},
      };
      const created = { profiles: [first], activeId: first.id };
      writeStore(session.userId, created);
      setStore(created);
      setPicking(true);
    } else {
      setStore(next);
      setPicking(!next.activeId);
    }
    setReady(true);
  }, [session?.signedIn, session?.userId, session?.userName]);

  const persist = useCallback(
    (next: Store) => {
      setStore(next);
      writeStore(session?.userId, next);
    },
    [session?.userId]
  );

  const updateActive = useCallback(
    (patch: (profile: ViewingProfile) => ViewingProfile) => {
      if (!store.activeId) return;
      persist({
        ...store,
        profiles: store.profiles.map((row) => (row.id === store.activeId ? patch(row) : row)),
      });
    },
    [persist, store]
  );

  const profile = store.profiles.find((row) => row.id === store.activeId) ?? null;

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles: store.profiles,
      profile,
      picking: Boolean(session?.signedIn && ready && (picking || !profile)),
      setPicking,
      selectProfile: (id) => {
        persist({ ...store, activeId: id });
        setPicking(false);
      },
      addProfile: (name) => {
        const next: ViewingProfile = {
          id: crypto.randomUUID(),
          name: name.trim() || `Profile ${store.profiles.length + 1}`,
          color: COLORS[store.profiles.length % COLORS.length],
          emoji: "🎬",
          favorites: [],
          watchlist: [],
          progress: {},
        };
        persist({ profiles: [...store.profiles, next], activeId: next.id });
        setPicking(false);
      },
      updateProfile: (id, patch) =>
        persist({
          ...store,
          profiles: store.profiles.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        }),
      removeProfile: (id) => {
        const profiles = store.profiles.filter((row) => row.id !== id);
        if (!profiles.length) return;
        persist({
          profiles,
          activeId: store.activeId === id ? profiles[0].id : store.activeId,
        });
      },
      toggleFavorite: (itemId) =>
        updateActive((row) => ({
          ...row,
          favorites: row.favorites.includes(itemId)
            ? row.favorites.filter((id) => id !== itemId)
            : [...row.favorites, itemId],
        })),
      toggleWatchlist: (itemId) =>
        updateActive((row) => ({
          ...row,
          watchlist: row.watchlist.includes(itemId)
            ? row.watchlist.filter((id) => id !== itemId)
            : [...row.watchlist, itemId],
        })),
      isFavorite: (itemId) => Boolean(profile?.favorites.includes(itemId)),
      isWatchlisted: (itemId) => Boolean(profile?.watchlist.includes(itemId)),
      rememberProgress: (itemId, positionTicks, played) =>
        updateActive((row) => ({
          ...row,
          progress: {
            ...row.progress,
            [itemId]: {
              positionTicks,
              played: played ?? row.progress[itemId]?.played ?? false,
              updatedAt: Date.now(),
            },
          },
        })),
      applyProfile: (item) => {
        const saved = profile?.progress[item.Id];
        if (!saved) return item;
        const runtime = item.RunTimeTicks || 0;
        return {
          ...item,
          UserData: {
            ...item.UserData,
            PlaybackPositionTicks: saved.positionTicks,
            Played: saved.played,
            PlayedPercentage:
              runtime > 0 ? Math.min(100, (saved.positionTicks / runtime) * 100) : item.UserData?.PlayedPercentage,
          },
        };
      },
      listedItems: (items, kind) => {
        const ids = new Set(profile?.[kind] ?? []);
        return items.filter((item) => ids.has(item.Id) || (item.SeriesId ? ids.has(item.SeriesId) : false));
      },
    }),
    [persist, picking, profile, ready, session?.signedIn, store, updateActive]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfiles must be used inside ProfileProvider");
  return ctx;
}
