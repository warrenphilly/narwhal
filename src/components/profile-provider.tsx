"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  lastEpisodeBySeries?: Record<string, { episodeId: string; updatedAt: number }>;
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
  rememberProgress: (
    itemId: string,
    positionTicks: number,
    played?: boolean,
    context?: { seriesId?: string }
  ) => void;
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

function activeProfile(store: Store) {
  return store.profiles.find((row) => row.id === store.activeId) ?? null;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [store, setStore] = useState<Store>({ profiles: [], activeId: null });
  const storeRef = useRef(store);
  const flushTimer = useRef<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    return () => {
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!session?.signedIn) {
      setStore({ profiles: [], activeId: null });
      storeRef.current = { profiles: [], activeId: null };
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
      storeRef.current = created;
      setStore(created);
      setPicking(true);
    } else {
      storeRef.current = next;
      setStore(next);
      setPicking(!next.activeId);
    }
    setReady(true);
  }, [session?.signedIn, session?.userId, session?.userName]);

  const scheduleFlush = useCallback(
    (next: Store) => {
      storeRef.current = next;
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(() => {
        writeStore(session?.userId, storeRef.current);
        flushTimer.current = null;
      }, 500);
    },
    [session?.userId]
  );

  const persist = useCallback(
    (next: Store) => {
      storeRef.current = next;
      setStore(next);
      writeStore(session?.userId, next);
    },
    [session?.userId]
  );

  const updateActive = useCallback(
    (patch: (profile: ViewingProfile) => ViewingProfile) => {
      const current = storeRef.current;
      if (!current.activeId) return;
      persist({
        ...current,
        profiles: current.profiles.map((row) => (row.id === current.activeId ? patch(row) : row)),
      });
    },
    [persist]
  );

  const rememberProgress = useCallback(
    (itemId: string, positionTicks: number, played?: boolean, context?: { seriesId?: string }) => {
      const current = storeRef.current;
      if (!current.activeId) return;
      const active = activeProfile(current);
      const prev = active?.progress[itemId];
      const nextPlayed = played ?? prev?.played ?? false;
      const now = Date.now();
      const seriesId = context?.seriesId;
      const lastEpisodeBySeries =
        seriesId && itemId
          ? { ...(active?.lastEpisodeBySeries ?? {}), [seriesId]: { episodeId: itemId, updatedAt: now } }
          : active?.lastEpisodeBySeries;

      if (
        prev &&
        prev.played === nextPlayed &&
        Math.abs(prev.positionTicks - positionTicks) < 20_000_000 &&
        !seriesId
      ) {
        return;
      }

      const next: Store = {
        ...current,
        profiles: current.profiles.map((row) =>
          row.id === current.activeId
            ? {
                ...row,
                lastEpisodeBySeries,
                progress: {
                  ...row.progress,
                  [itemId]: { positionTicks, played: nextPlayed, updatedAt: now },
                },
              }
            : row
        ),
      };
      scheduleFlush(next);
    },
    [scheduleFlush]
  );

  const applyProfile = useCallback((item: JellyfinItem) => {
    const saved = activeProfile(storeRef.current)?.progress[item.Id];
    if (!saved || saved.positionTicks < 10 * 10_000_000) return item;
    const runtime = item.RunTimeTicks || 0;
    const finished = Boolean(saved.played && runtime > 0 && saved.positionTicks >= runtime * 0.95);
    const ticks = Math.max(saved.positionTicks, item.UserData?.PlaybackPositionTicks ?? 0);
    return {
      ...item,
      UserData: {
        ...item.UserData,
        PlaybackPositionTicks: finished ? 0 : ticks,
        Played: finished || Boolean(item.UserData?.Played),
        PlayedPercentage:
          runtime > 0 ? Math.min(100, (ticks / runtime) * 100) : item.UserData?.PlayedPercentage,
      },
    };
  }, []);

  const profile = store.profiles.find((row) => row.id === store.activeId) ?? null;

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles: store.profiles,
      profile,
      picking: Boolean(session?.signedIn && ready && (picking || !profile)),
      setPicking,
      selectProfile: (id) => {
        persist({ ...storeRef.current, activeId: id });
        setPicking(false);
      },
      addProfile: (name) => {
        const current = storeRef.current;
        const next: ViewingProfile = {
          id: crypto.randomUUID(),
          name: name.trim() || `Profile ${current.profiles.length + 1}`,
          color: COLORS[current.profiles.length % COLORS.length],
          emoji: "🎬",
          favorites: [],
          watchlist: [],
          progress: {},
        };
        persist({ profiles: [...current.profiles, next], activeId: next.id });
        setPicking(false);
      },
      updateProfile: (id, patch) => {
        const current = storeRef.current;
        persist({
          ...current,
          profiles: current.profiles.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        });
      },
      removeProfile: (id) => {
        const current = storeRef.current;
        const profiles = current.profiles.filter((row) => row.id !== id);
        if (!profiles.length) return;
        persist({
          profiles,
          activeId: current.activeId === id ? profiles[0].id : current.activeId,
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
      rememberProgress,
      applyProfile,
      listedItems: (items, kind) => {
        const ids = new Set(profile?.[kind] ?? []);
        return items.filter((item) => ids.has(item.Id) || (item.SeriesId ? ids.has(item.SeriesId) : false));
      },
    }),
    [applyProfile, persist, picking, profile, ready, rememberProgress, session?.signedIn, store.profiles, store.activeId, updateActive]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfiles must be used inside ProfileProvider");
  return ctx;
}
