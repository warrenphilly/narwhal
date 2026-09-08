"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { Carousel } from "@/components/carousel";
import { ContinueCard } from "@/components/continue-card";
import { PosterCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export function Shelf({
  title,
  items,
  variant = "poster",
  onMove,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  title: string;
  items: JellyfinItem[];
  variant?: "poster" | "continue";
  onMove?: (item: JellyfinItem) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}) {
  if (!items.length && !onMoveUp) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
        {onMoveUp && (
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${title} up`} onClick={onMoveUp}>
              <ChevronUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${title} down`} onClick={onMoveDown}>
              <ChevronDown />
            </Button>
            {onRemove && items.length === 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      {items.length > 0 ? (
        <Carousel>
          {items.map((item) =>
            variant === "continue" ? (
              <ContinueCard key={item.Id} item={item} />
            ) : (
              <PosterCard key={item.Id} item={item} onMove={onMove} />
            )
          )}
        </Carousel>
      ) : (
        <p className="text-sm text-zinc-500">Empty group. Move a title here or remove it.</p>
      )}
    </section>
  );
}
