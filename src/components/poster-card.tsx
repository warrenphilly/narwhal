"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/client-api";
import { titlePageHref } from "@/lib/item-href";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";
import { cn } from "@/lib/utils";

export function PosterCard({
  item,
  size = "md",
}: {
  item: JellyfinItem;
  size?: "sm" | "md" | "lg";
}) {
  const demo = isDemoId(item.Id);
  const imageId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  const [from, to] = demoPosterGradient(item.Id);
  const progress = item.UserData?.PlayedPercentage;
  const widths = { sm: "w-[120px]", md: "w-[168px]", lg: "w-[210px]" };

  return (
    <Link
      href={titlePageHref(item)}
      className={cn(
        "poster-card group relative shrink-0 snap-start outline-none",
        widths[size]
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-200 shadow-[0_16px_36px_rgba(0,0,0,0.12)] ring-2 ring-transparent transition duration-300 group-hover:scale-[1.06] group-hover:ring-zinc-900 group-focus-visible:scale-[1.06] group-focus-visible:ring-zinc-900 dark:bg-zinc-800 dark:group-hover:ring-zinc-100 dark:group-focus-visible:ring-zinc-100">
        {demo ? (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(imageId, { maxHeight: 540 })}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-sm font-medium text-white">{item.Name}</p>
          <p className="mt-0.5 text-xs text-white/70">
            {[item.ProductionYear, formatRuntime(item.RunTimeTicks)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {typeof progress === "number" && progress > 0 && progress < 100 && (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm text-zinc-800 dark:text-zinc-200">
        {item.SeriesName || item.Name}
      </p>
    </Link>
  );
}
