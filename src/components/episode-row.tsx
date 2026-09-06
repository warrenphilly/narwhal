"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { continueImageUrl } from "@/lib/client-api";
import { episodeLabel } from "@/lib/clock";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { Button } from "@/components/ui/button";

export function EpisodeRow({
  item,
  eyebrow,
  onDownload,
  downloading,
}: {
  item: JellyfinItem;
  eyebrow?: string;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const router = useRouter();
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  const progress = item.UserData?.PlayedPercentage;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push(`/watch/${item.Id}`)}
        className="flex min-w-0 flex-1 gap-4 py-4 text-left transition hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.03]"
      >
        <div className="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-xl bg-zinc-200 sm:w-[220px] dark:bg-zinc-800">
          {demo ? (
            <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={continueImageUrl(item)}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {typeof progress === "number" && progress > 0 && progress < 100 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
              <div className="h-full bg-white" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            {eyebrow || episodeLabel(item)}
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{item.Name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {formatRuntime(item.RunTimeTicks)}
            {item.UserData?.Played ? " · Watched" : ""}
          </p>
          {item.Overview && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.Overview}
            </p>
          )}
        </div>
      </button>
      {onDownload && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={demo || downloading}
          aria-label={`Download ${item.Name}`}
          onClick={onDownload}
        >
          <Download />
        </Button>
      )}
    </div>
  );
}
