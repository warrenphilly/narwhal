"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/client-api";
import { titlePageHref } from "@/lib/item-href";
import { formatCardFacts } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";
import { cn } from "@/lib/utils";

export function PosterCard({
  item,
  size = "md",
  layout = "shelf",
  onMove,
}: {
  item: JellyfinItem;
  size?: "sm" | "md" | "lg";
  layout?: "shelf" | "grid";
  onMove?: (item: JellyfinItem) => void;
}) {
  const demo = isDemoId(item.Id);
  const imageId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  const [from, to] = demoPosterGradient(item.Id);
  const progress = item.UserData?.PlayedPercentage;
  const widths = { sm: "w-[132px] sm:w-[148px]", md: "w-[158px] sm:w-[210px]", lg: "w-[180px] sm:w-[248px]" };
  const facts = formatCardFacts(item);

  return (
    <Link
      href={titlePageHref(item)}
      className={cn(
        "poster-card group relative snap-start outline-none",
        layout === "grid" ? "min-w-0 w-full" : cn("shrink-0", widths[size])
      )}
    >
      <div className="poster-case relative aspect-[2/3] overflow-hidden bg-zinc-800">
        {demo ? (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(imageId, { maxHeight: 480 })}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-sm font-medium text-white">{item.Name}</p>
          <p className="mt-0.5 text-xs text-white/70">
            {[item.ProductionYear, facts].filter(Boolean).join(" · ")}
          </p>
        </div>
        {onMove && (
          <button
            type="button"
            className="absolute top-2 right-2 z-10 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white ring-1 ring-white/20"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMove(item);
            }}
          >
            Move
          </button>
        )}
        {typeof progress === "number" && progress > 0 && progress < 100 && (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2.5 line-clamp-1 text-sm text-[var(--page-fg)]">
        {item.SeriesName || item.Name}
      </p>
      {facts && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{facts}</p>}
    </Link>
  );
}
