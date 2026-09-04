"use client";

import { PosterCard } from "@/components/poster-card";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export function Shelf({
  title,
  items,
}: {
  title: string;
  items: JellyfinItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <h2 className="px-4 text-xl font-semibold tracking-tight text-zinc-900 sm:px-8">
        {title}
      </h2>
      <div className="shelf-scroll flex gap-4 overflow-x-auto px-4 pb-4 pt-2 sm:px-8">
        {items.map((item) => (
          <PosterCard key={item.Id} item={item} />
        ))}
      </div>
    </section>
  );
}
