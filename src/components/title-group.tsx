"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchMovies, fetchShows } from "@/lib/client-api";
import {
  addGroup,
  collectGroupNames,
  defaultGroup,
  loadGroups,
  moveItem,
  saveGroups,
  type GroupStore,
} from "@/lib/library-groups";
import type { MediaTab } from "@/lib/media-tab";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { cn } from "@/lib/utils";

export function TitleGroupControl({
  item,
  userId,
  tab,
  className,
}: {
  item: JellyfinItem;
  userId?: string;
  tab: MediaTab;
  className?: string;
}) {
  const [store, setStore] = useState<GroupStore>({ order: [], extra: [], assign: {} });
  const [library, setLibrary] = useState<JellyfinItem[]>([]);
  const [custom, setCustom] = useState("");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });

  useEffect(() => {
    if (!userId) return;
    setStore(loadGroups(userId, tab));
    (tab === "movies" ? fetchMovies(userId) : fetchShows(userId))
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }, [userId, tab]);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(420, Math.max(160, openUp ? spaceAbove : spaceBelow));
      setMenu({
        top: openUp ? rect.top - maxHeight - 8 : rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 260) - 12),
        width: Math.max(rect.width, 260),
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  if (!userId) return null;

  const current = store.assign[item.Id] || defaultGroup(item);
  const names = collectGroupNames(store, library, item.Genres ?? []);

  function persist(next: GroupStore) {
    setStore(next);
    saveGroups(userId!, tab, next);
  }

  return (
    <div className={cn("relative z-30 overflow-visible rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-black/50", className)}>
      <Label className="text-xs tracking-wide text-zinc-500 uppercase">Home grouping</Label>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">Now in {current}. Put it on any shelf.</p>
      <button
        ref={buttonRef}
        type="button"
        className="mt-2 flex h-11 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 text-left text-sm dark:border-white/15 dark:bg-zinc-950"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{current}</span>
        <ChevronDown className="size-4 text-zinc-400" />
      </button>
      {open &&
        createPortal(
          <>
            <button type="button" className="fixed inset-0 z-[90]" aria-label="Close grouping list" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[91] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-white/15 dark:bg-zinc-950"
              style={{ top: menu.top, left: menu.left, width: menu.width, maxHeight: menu.maxHeight }}
            >
              {names.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/10"
                  onClick={() => {
                    persist(moveItem(store, item.Id, name));
                    setOpen(false);
                  }}
                >
                  {name === current ? `✓ ${name}` : name}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!custom.trim()) return;
          persist(moveItem(addGroup(store, custom), item.Id, custom.trim()));
          setCustom("");
        }}
      >
        <Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="New group" />
        <Button type="submit" size="sm" className="rounded-full" disabled={!custom.trim()}>
          Save
        </Button>
      </form>
    </div>
  );
}
