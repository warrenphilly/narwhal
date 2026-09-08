"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { continueImageUrl } from "@/lib/client-api";
import { episodeLabel } from "@/lib/clock";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";
import { formatCardFacts } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export function ContinueCard({ item }: { item: JellyfinItem }) {
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  const progress = item.UserData?.PlayedPercentage;
  const title = item.SeriesName || item.Name;
  const facts = formatCardFacts(item);
  const detail =
    item.Type === "Episode"
      ? [episodeLabel(item), item.Name, facts].filter(Boolean).join(" · ")
      : facts;

  return (
    <Link
      href={item.Type === "Series" && item.Id ? `/show/${item.Id}` : `/watch/${item.Id}`}
      className="continue-card group relative w-[min(48vw,190px)] shrink-0 snap-start outline-none sm:w-[380px]"
    >
      <div className="continue-case relative aspect-video overflow-hidden bg-zinc-900">
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
          <span className="flex size-9 items-center justify-center rounded-full bg-white text-zinc-900 opacity-0 shadow-lg transition group-hover:opacity-100 sm:size-12">
            <Play className="size-4 fill-current sm:size-5" />
          </span>
        </div>
        {typeof progress === "number" && progress > 0 && progress < 100 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-xs font-medium text-[var(--page-fg)] sm:mt-2.5 sm:text-sm">{title}</p>
      {detail && <p className="line-clamp-1 text-[10px] text-muted sm:text-xs">{detail}</p>}
    </Link>
  );
}
