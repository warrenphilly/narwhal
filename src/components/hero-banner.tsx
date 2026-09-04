"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDownloads } from "@/components/downloads-provider";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { imageUrl } from "@/lib/client-api";
import { isDemoId, demoPosterGradient } from "@/lib/demo-library";

export function HeroBanner({ item }: { item: JellyfinItem }) {
  const router = useRouter();
  const { downloadMovie } = useDownloads();
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  const backdrop = demo
    ? undefined
    : imageUrl(item.Id, {
        type: item.BackdropImageTags?.length ? "Backdrop" : "Primary",
        maxWidth: 1920,
      });

  return (
    <section className="relative min-h-[72vh] overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{
          backgroundImage: backdrop
            ? `url(${backdrop})`
            : `linear-gradient(135deg, ${from}, ${to})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      <div className="relative mx-auto flex min-h-[72vh] max-w-[1600px] flex-col justify-end px-4 pb-10 pt-28 sm:px-8 sm:pb-16">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-white/55 uppercase">
          Featured
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
          {item.Name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.OfficialRating && (
            <span className="rounded border border-white/25 px-1.5 py-0.5 text-xs">
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
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            {item.Overview}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="h-12 rounded-full bg-white px-6 text-base text-black hover:bg-white/90"
            onClick={() => router.push(`/watch/${item.Id}`)}
          >
            <Play data-icon="inline-start" className="fill-current" />
            Play
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-12 rounded-full bg-white/15 px-6 text-base text-white hover:bg-white/25"
            onClick={() => downloadMovie(item).catch(() => undefined)}
            disabled={demo}
          >
            <Download data-icon="inline-start" />
            {demo ? "Connect to download" : "Download"}
          </Button>
          <Link
            href={`/movie/${item.Id}`}
            className="inline-flex h-12 items-center rounded-full px-6 text-base text-white hover:bg-white/10"
          >
            Details
          </Link>
        </div>
      </div>
    </section>
  );
}
