"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { Carousel } from "@/components/carousel";
import { ContinueCard } from "@/components/continue-card";
import { PosterCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { cn } from "@/lib/utils";

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
    <section
      className={cn(
        "shelf-section space-y-3",
        variant === "continue" && "glass-panel glass-edge rounded-[1.75rem] p-4 sm:p-6"
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--page-fg)]">{title}</h2>
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
        <Carousel itemGap={variant === "continue" ? "gap-6" : "gap-5"}>
          {items.slice(0, 24).map((item) =>
            variant === "continue" ? (
              <ContinueCard key={item.Id} item={item} />
            ) : (
              <PosterCard key={item.Id} item={item} onMove={onMove} />
            )
          )}
        </Carousel>
      ) : (
        <p className="text-sm text-muted">Empty group. Move a title here or remove it.</p>
      )}
    </section>
  );
}
