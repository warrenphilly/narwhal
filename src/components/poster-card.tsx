"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/client-api";
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
  const [from, to] = demoPosterGradient(item.Id);
  const progress = item.UserData?.PlayedPercentage;
  const widths = { sm: "w-[120px]", md: "w-[168px]", lg: "w-[210px]" };

  return (
    <Link
      href={`/movie/${item.Id}`}
      className={cn(
        "poster-card group relative shrink-0 snap-start outline-none",
        widths[size]
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#1c1c1e] shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-2 ring-transparent transition duration-300 group-hover:scale-[1.06] group-hover:ring-white group-focus-visible:scale-[1.06] group-focus-visible:ring-white">
        {demo ? (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(item.Id, { maxHeight: 540 })}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-sm font-medium text-white">{item.Name}</p>
          <p className="mt-0.5 text-xs text-white/60">
            {[item.ProductionYear, formatRuntime(item.RunTimeTicks)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {typeof progress === "number" && progress > 0 && progress < 100 && (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm text-white/80">{item.Name}</p>
    </Link>
  );
}
