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

function HeroSlide({
  item,
  featuredLabel,
  onPlay,
  onDownload,
  demo,
}: {
  item: FeaturedItem;
  featuredLabel: string;
  onPlay: () => void;
  onDownload: () => void;
  demo: boolean;
}) {
  const [from, to] = demoPosterGradient(item.Id);

  return (
    <div className="relative h-full w-full shrink-0 grow-0 basis-full">
      <HeroArt item={demo ? null : item} gradient={[from, to]} />
      <div className="hero-wash absolute inset-0" />
      <div className="relative z-10 flex h-full flex-col justify-end gap-4 p-4 pb-20 sm:p-6 sm:pb-24 lg:p-8 lg:pb-24">
        <div className="max-w-xl">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-white/80 uppercase">{featuredLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight break-words text-white sm:text-4xl lg:text-5xl">
            {item.Name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-white/90">
            {item.ProductionYear && <span>{item.ProductionYear}</span>}
            {item.OfficialRating && (
              <span className="rounded border border-white/35 px-1.5 py-0.5 text-xs">{item.OfficialRating}</span>
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
            <Button size="lg" className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base" onClick={onPlay}>
              <Play data-icon="inline-start" className="fill-current" />
              {item.Type === "Series" ? "Open series" : "Play"}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-10 rounded-full px-5 text-sm sm:h-11 sm:text-base"
              onClick={onDownload}
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
      </div>
    </div>
  );
}

export function HeroBanner({ items }: { items: (JellyfinItem | FeaturedItem)[] }) {
  const router = useRouter();
  const { downloadMovie } = useDownloads();
  const lineup = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animate, setAnimate] = useState(true);
  const count = lineup.length;
  const safeIndex = count ? ((index % count) + count) % count : 0;

  function featuredLabel(entry: FeaturedItem) {
    if (entry.hasNewEpisodes) return "New episodes";
    if (entry.Type === "Series") return "Featured series";
    return "New addition";
  }

  function goTo(next: number, withMotion = true) {
    if (!count) return;
    const normalized = ((next % count) + count) % count;
    if (!withMotion) {
      setAnimate(false);
      setIndex(normalized);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimate(true));
      });
      return;
    }
    setAnimate(true);
    setIndex(normalized);
  }

  function goNext() {
    if (safeIndex === count - 1) {
      goTo(0, false);
      return;
    }
    goTo(safeIndex + 1);
  }

  function goPrev() {
    if (safeIndex === 0) {
      goTo(count - 1, false);
      return;
    }
    goTo(safeIndex - 1);
  }

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        const at = ((current % count) + count) % count;
        if (at === count - 1) {
          setAnimate(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setAnimate(true));
          });
          return 0;
        }
        setAnimate(true);
        return at + 1;
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  if (!lineup[0]) return null;

  return (
    <section
      className="hero-banner glass-edge relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={cn("flex h-full w-full will-change-transform", animate && "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]")}
        style={{ transform: `translate3d(-${safeIndex * 100}%, 0, 0)` }}
      >
        {lineup.map((entry) => {
          const item = entry as FeaturedItem;
          const demo = isDemoId(item.Id);
          return (
            <HeroSlide
              key={item.Id}
              item={item}
              featuredLabel={featuredLabel(item)}
              demo={demo}
              onPlay={() => router.push(titlePageHref(item))}
              onDownload={() => {
                if (item.Type === "Series") {
                  router.push(titlePageHref(item));
                  return;
                }
                downloadMovie(item).catch(() => undefined);
              }}
            />
          );
        })}
      </div>

      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous featured title"
              onClick={goPrev}
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
                  onClick={() => goTo(dot)}
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
              onClick={goNext}
              className="glass-chip flex size-10 items-center justify-center rounded-full text-white"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
