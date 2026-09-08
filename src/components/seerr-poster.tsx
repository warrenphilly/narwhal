"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { posterUrl, statusLabel, type SeerrSearchResult } from "@/lib/seerr";
import { cn } from "@/lib/utils";

export function SeerrPoster({
  item,
  requesting,
  onRequest,
}: {
  item: SeerrSearchResult;
  requesting?: boolean;
  onRequest: (item: SeerrSearchResult) => void;
}) {
  const title = item.title || item.name || "Untitled";
  const year = (item.releaseDate || item.firstAirDate || "").slice(0, 4);
  const status = statusLabel(item.mediaInfo?.status);
  const canRequest = !item.mediaInfo?.status || item.mediaInfo.status < 2;
  const art = posterUrl(item.posterPath, "w500");
  const href = `/discover/${item.mediaType}/${item.id}`;

  return (
    <article className="w-[240px] shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900">
      <Link href={href} className="block aspect-[2/3] bg-zinc-200 dark:bg-zinc-800">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="size-full object-cover" />
        ) : null}
      </Link>
      <div className="space-y-2.5 p-4">
        <Link href={href} className="block">
          <p className="line-clamp-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
            {year ? ` (${year})` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{item.mediaType === "tv" ? "TV" : "Movie"}</p>
        </Link>
        {status ? (
          <p className={cn("text-sm", item.mediaInfo?.status === 5 ? "text-emerald-600" : "text-sky-600")}>{status}</p>
        ) : null}
        {canRequest && (
          <Button
            size="sm"
            className="h-9 w-full rounded-full"
            disabled={requesting}
            onClick={(event) => {
              event.preventDefault();
              onRequest(item);
            }}
          >
            {requesting ? "Requesting…" : "Request"}
          </Button>
        )}
      </div>
    </article>
  );
}
