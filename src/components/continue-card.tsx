"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { continueImageUrl } from "@/lib/client-api";
import { episodeLabel } from "@/lib/clock";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { cn } from "@/lib/utils";

export function ContinueCard({ item }: { item: JellyfinItem }) {
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  const progress = item.UserData?.PlayedPercentage;
  const ratio = item.PrimaryImageAspectRatio;
  const landscape = !ratio || ratio >= 1;
  const title = item.SeriesName || item.Name;
  const detail =
    item.Type === "Episode"
      ? [episodeLabel(item), item.Name].filter(Boolean).join(" · ")
      : item.Name;

  return (
    <Link
      href={`/watch/${item.Id}`}
      className="group relative w-[280px] shrink-0 snap-start outline-none sm:w-[340px]"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-zinc-200 shadow-[0_16px_36px_rgba(0,0,0,0.12)] ring-2 ring-transparent transition duration-300 group-hover:scale-[1.03] group-hover:ring-zinc-900 group-focus-visible:scale-[1.03] group-focus-visible:ring-zinc-900",
          landscape ? "aspect-video" : "aspect-[2/3]"
        )}
      >
        {demo ? (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={continueImageUrl(item)}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
          <span className="flex size-12 items-center justify-center rounded-full bg-white text-zinc-900 opacity-0 shadow-lg transition group-hover:opacity-100">
            <Play className="size-5 fill-current" />
          </span>
        </div>
        {typeof progress === "number" && progress > 0 && progress < 100 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-zinc-900">{title}</p>
      <p className="line-clamp-1 text-xs text-zinc-500">{detail}</p>
    </Link>
  );
}
