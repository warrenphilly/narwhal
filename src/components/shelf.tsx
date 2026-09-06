"use client";

import { Carousel } from "@/components/carousel";
import { ContinueCard } from "@/components/continue-card";
import { PosterCard } from "@/components/poster-card";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export function Shelf({
  title,
  items,
  variant = "poster",
}: {
  title: string;
  items: JellyfinItem[];
  variant?: "poster" | "continue";
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <Carousel>
        {items.map((item) =>
          variant === "continue" ? (
            <ContinueCard key={item.Id} item={item} />
          ) : (
            <PosterCard key={item.Id} item={item} />
          )
        )}
      </Carousel>
    </section>
  );
}
