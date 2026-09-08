"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDownloads } from "@/components/downloads-provider";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { imageUrl } from "@/lib/client-api";
import { titlePageHref } from "@/lib/item-href";
import { isDemoId, demoPosterGradient } from "@/lib/demo-library";
import { cn } from "@/lib/utils";

export function HeroBanner({ items }: { items: JellyfinItem[] }) {
  const router = useRouter();
  const { downloadMovie } = useDownloads();
  const lineup = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = lineup.length ? index % lineup.length : 0;
  const item = lineup[safeIndex];

  useEffect(() => {
    if (paused || lineup.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, lineup.length]);

  if (!item) return null;

  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  const backdrop = demo
    ? undefined
    : imageUrl(item.Id, {
        type: item.BackdropImageTags?.length ? "Backdrop" : "Primary",
        maxWidth: 1920,
      });

  function play() {
    if (item.Type === "Series") {
      router.push(titlePageHref(item));
      return;
    }
    window.location.assign(`/watch/${item.Id}`);
  }

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backdrop
            ? `url(${backdrop})`
            : `linear-gradient(135deg, ${from}, ${to})`,
        }}
      />
      <div className="hero-wash absolute inset-0" />
      <div className="relative z-10 mx-auto flex max-w-[1600px] flex-col px-4 py-6 sm:px-8 sm:py-10">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-zinc-700 uppercase dark:text-zinc-200">
          {item.Type === "Series" ? "Featured series" : "New addition"}
        </p>
        <h1 className="max-w-3xl text-2xl font-semibold tracking-tight break-words text-zinc-950 drop-shadow-sm sm:text-4xl lg:text-5xl dark:text-white">
          {item.Name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.OfficialRating && (
            <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-600">
              {item.OfficialRating}
            </span>
          )}
          {item.CommunityRating && <span>{item.CommunityRating.toFixed(1)} ★</span>}
          {item.RunTimeTicks && <span>{formatRuntime(item.RunTimeTicks)}</span>}
          {item.Genres?.slice(0, 2).map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
        {item.Overview && (
          <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-zinc-800 sm:text-base dark:text-zinc-100">
            {item.Overview}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
          <Button size="lg" className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base" onClick={() => play()}>
            <Play data-icon="inline-start" className="fill-current" />
            {item.Type === "Series" ? "Open series" : "Play"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base"
            onClick={() => {
              if (item.Type === "Series") {
                router.push(titlePageHref(item));
                return;
              }
              downloadMovie(item).catch(() => undefined);
            }}
            disabled={demo && item.Type !== "Series"}
          >
            <Download data-icon="inline-start" />
            {item.Type === "Series" ? "Details" : demo ? "Connect to download" : "Download"}
          </Button>
          <Link
            href={titlePageHref(item)}
            className="inline-flex h-10 items-center rounded-full px-5 text-sm text-zinc-700 hover:bg-black/5 sm:h-11 sm:text-base dark:text-zinc-200 dark:hover:bg-white/8"
          >
            Details
          </Link>
        </div>
        {lineup.length > 1 && (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous featured title"
              onClick={() => setIndex((current) => current - 1 + lineup.length)}
              className="flex size-10 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md ring-1 ring-black/8 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-white/10"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="flex gap-2">
              {lineup.map((entry, dot) => (
                <button
                  key={entry.Id}
                  type="button"
                  aria-label={`Show ${entry.Name}`}
                  onClick={() => setIndex(dot)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    dot === safeIndex ? "w-8 bg-zinc-900 dark:bg-zinc-100" : "w-3 bg-zinc-900/25 dark:bg-white/30"
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next featured title"
              onClick={() => setIndex((current) => current + 1)}
              className="flex size-10 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md ring-1 ring-black/8 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-white/10"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
