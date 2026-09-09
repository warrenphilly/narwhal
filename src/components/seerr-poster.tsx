"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MEDIA_STATUS, posterUrl, statusLabel, type SeerrSearchResult } from "@/lib/seerr";

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
  const canRequest =
    item.mediaType === "tv" || !item.mediaInfo?.status || item.mediaInfo.status < MEDIA_STATUS.pending;
  const art = posterUrl(item.posterPath, "w500");
  const href = `/discover/${item.mediaType}/${item.id}`;

  return (
    <article className="poster-card group relative w-[210px] shrink-0 snap-start">
      <Link href={href} className="block outline-none">
        <div className="poster-case relative aspect-[2/3] overflow-hidden bg-zinc-800">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}
          {canRequest && (
            <Button
              size="sm"
              className="absolute inset-x-2 bottom-2 z-10 h-8 rounded-full opacity-0 transition group-hover:opacity-100"
              disabled={requesting}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRequest(item);
              }}
            >
              {requesting ? "Requesting…" : "Request"}
            </Button>
          )}
        </div>
        <p className="mt-2.5 line-clamp-1 text-sm text-[var(--page-fg)]">
          {title}
          {year ? ` (${year})` : ""}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
          {item.mediaType === "tv" ? "TV show" : "Movie"}
          {status ? ` · ${status}` : ""}
        </p>
      </Link>
    </article>
  );
}
