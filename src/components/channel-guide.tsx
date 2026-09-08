"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { Button } from "@/components/ui/button";
import { expandChannelItems, buildGuideBlocks, type GuideBlock } from "@/lib/channel-play";
import type { Channel } from "@/lib/channels";
import type { JellyfinItem } from "@/lib/jellyfin-types";

const HOURS = [6, 12] as const;

function hourLabel(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function titleOf(item: JellyfinItem) {
  if (item.Type === "Episode") {
    const ep = [item.ParentIndexNumber && `S${item.ParentIndexNumber}`, item.IndexNumber && `E${item.IndexNumber}`]
      .filter(Boolean)
      .join("");
    return `${item.SeriesName || item.Name}${ep ? ` · ${ep}` : ""}`;
  }
  return item.Name;
}

export function ChannelGuide({
  channels,
  userId,
}: {
  channels: Channel[];
  userId?: string;
}) {
  const [hours, setHours] = useState<(typeof HOURS)[number]>(6);
  const [rows, setRows] = useState<{ channel: Channel; blocks: GuideBlock[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const stamp = channels.map((row) => `${row.id}:${row.kind}:${row.alwaysOn}:${row.hours}:${row.entries.map((entry) => entry.itemId).join(",")}`).join("|");
  const start = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0);
    return now.getTime();
  }, [hours]);
  const windowMs = hours * 60 * 60 * 1000;
  const pxPerMin = hours === 6 ? 4 : 2.5;
  const width = hours * 60 * pxPerMin;
  const ticks = Array.from({ length: hours * 2 + 1 }, (_, i) => start + i * 30 * 60 * 1000);
  const now = Date.now();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setBusy(true);
    Promise.all(
      channels.map(async (channel) => {
        const items = await expandChannelItems(channel, userId).catch(() => [] as JellyfinItem[]);
        return { channel, blocks: buildGuideBlocks(channel, items, start, windowMs) };
      })
    )
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, hours, start, windowMs, stamp]);

  if (!channels.length) return null;

  return (
    <section className="w-full rounded-2xl border border-black/8 bg-white/70 p-4 dark:border-white/10 dark:bg-black/30">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Guide</h2>
        <p className="text-sm text-zinc-500">What is on for the next {hours} hours.</p>
        <div className="ml-auto flex gap-2">
          {HOURS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              className="rounded-full"
              variant={hours === value ? "default" : "outline"}
              onClick={() => setHours(value)}
            >
              {value} hours
            </Button>
          ))}
        </div>
      </div>
      {busy && rows.length === 0 ? (
        <div className="py-8">
          <NarwhalSpinner label="Building tonight’s guide…" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div style={{ minWidth: 180 + width }}>
            <div className="flex border-b border-black/8 pb-2 text-xs text-zinc-500 dark:border-white/10">
              <div className="w-44 shrink-0 pr-3">Channel</div>
              <div className="relative h-5" style={{ width }}>
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute -translate-x-1/2"
                    style={{ left: ((tick - start) / 60000) * pxPerMin }}
                  >
                    {hourLabel(tick)}
                  </span>
                ))}
              </div>
            </div>
            {rows.map(({ channel, blocks }) => (
              <div key={channel.id} className="flex border-b border-black/5 py-2 dark:border-white/5">
                <div className="w-44 shrink-0 pr-3">
                  <p className="truncate font-medium">{channel.name}</p>
                  <p className="text-xs text-zinc-500">{channel.kind === "shuffle" ? "Shuffle" : "Queue"}</p>
                </div>
                <div className="relative h-16" style={{ width }}>
                  {now >= start && now <= start + windowMs && (
                    <div
                      className="absolute top-0 z-10 h-full w-px bg-[#AA5CC3]"
                      style={{ left: ((now - start) / 60000) * pxPerMin }}
                    />
                  )}
                  {blocks.map((block) => {
                    const left = ((Math.max(block.start, start) - start) / 60000) * pxPerMin;
                    const right = ((Math.min(block.end, start + windowMs) - start) / 60000) * pxPerMin;
                    const live = now >= block.start && now < block.end;
                    return (
                      <Link
                        key={`${channel.id}-${block.item.Id}-${block.start}`}
                        href={`/channels/${channel.id}/watch?item=${encodeURIComponent(block.item.Id)}`}
                        className={`absolute top-0 flex h-16 flex-col justify-center overflow-hidden rounded-lg px-2 text-left text-xs ${
                          live
                            ? "bg-gradient-to-r from-[#00A4DC] to-[#AA5CC3] text-white"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                        }`}
                        style={{ left, width: Math.max(48, right - left - 4) }}
                      >
                        <span className="line-clamp-2 font-medium">{titleOf(block.item)}</span>
                        <span className={live ? "text-white/80" : "text-zinc-500"}>
                          {hourLabel(block.start)}–{hourLabel(block.end)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
