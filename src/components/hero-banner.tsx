"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDownloads } from "@/components/downloads-provider";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { FeaturedItem } from "@/lib/client-api";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { titlePageHref } from "@/lib/item-href";
import { isDemoId, demoPosterGradient } from "@/lib/demo-library";
import { HeroArt } from "@/components/hero-art";
import { cn } from "@/lib/utils";

export function HeroBanner({ items }: { items: (JellyfinItem | FeaturedItem)[] }) {
  const router = useRouter();
  const { downloadMovie } = useDownloads();
  const lineup = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = lineup.length ? index % lineup.length : 0;
  const item = lineup[safeIndex] as FeaturedItem;

  function featuredLabel(entry: FeaturedItem) {
    if (entry.hasNewEpisodes) return "New episodes";
    if (entry.Type === "Series") return "Featured series";
    return "New addition";
  }

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

  function play() {
    router.push(titlePageHref(item));
  }

  return (
    <section
      className="hero-banner glass-edge relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroArt item={demo ? null : item} gradient={[from, to]} />
      <div className="hero-wash absolute inset-0" />
      <div className="relative z-10 flex h-full flex-col justify-end gap-4 p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-white/80 uppercase">
            {featuredLabel(item)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight break-words text-white sm:text-4xl lg:text-5xl">
            {item.Name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-white/90">
            {item.ProductionYear && <span>{item.ProductionYear}</span>}
            {item.OfficialRating && (
              <span className="rounded border border-white/35 px-1.5 py-0.5 text-xs">
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
            <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
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
              className="inline-flex h-10 items-center rounded-full px-5 text-sm text-white/90 hover:bg-white/10 sm:h-11 sm:text-base"
            >
              Details
            </Link>
          </div>
        </div>
        {lineup.length > 1 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous featured title"
              onClick={() => setIndex((current) => current - 1 + lineup.length)}
              className="glass-chip flex size-10 items-center justify-center rounded-full text-white"
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
                    dot === safeIndex ? "w-8 bg-white" : "w-3 bg-white/35"
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next featured title"
              onClick={() => setIndex((current) => current + 1)}
              className="glass-chip flex size-10 items-center justify-center rounded-full text-white"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
