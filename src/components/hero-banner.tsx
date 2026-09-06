"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
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
    router.push(`/watch/${item.Id}`);
  }

  return (
    <section
      className="relative min-h-[72vh] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: backdrop
            ? `url(${backdrop})`
            : `linear-gradient(135deg, ${from}, ${to})`,
        }}
      />
      <div className="hero-wash absolute inset-0" />
      <div className="relative mx-auto flex min-h-[72vh] max-w-[1600px] flex-col justify-end px-4 pb-10 pt-28 sm:px-8 sm:pb-16">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
          {item.Type === "Series" ? "Featured series" : "New addition"}
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-zinc-900 sm:text-7xl dark:text-zinc-50">
          {item.Name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
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
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
            {item.Overview}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" className="h-12 rounded-full px-6 text-base" onClick={() => play()}>
            <Play data-icon="inline-start" className="fill-current" />
            {item.Type === "Series" ? "Open series" : "Play"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-12 rounded-full px-6 text-base"
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
            className="inline-flex h-12 items-center rounded-full px-6 text-base text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/8"
          >
            Details
          </Link>
        </div>
        {lineup.length > 1 && (
          <div className="mt-8 flex gap-2">
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
        )}
      </div>
    </section>
  );
}
